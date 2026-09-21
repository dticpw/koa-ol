"""Exercise destructive rollback only inside disposable repositories."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO=Path(__file__).resolve().parents[1]
ARTIFACTS=Path(os.environ.get('FICTION_TEST_ARTIFACTS',REPO.parent/'agent-artifacts/fiction-release-tests'))
ARTIFACTS.mkdir(parents=True,exist_ok=True)

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='rollback-',dir=ARTIFACTS))
        self.repo=self.root/'repo';self.repo.mkdir()
        self.git('init','-q');self.git('config','core.fileMode','false')
        self.git('config','user.name','Release Test');self.git('config','user.email','test@invalid.local')
        for file in ['scripts/fiction_release.py','config/fiction-release.json']:
            (self.repo/file).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(REPO/file,self.repo/file)
        self.put('functions/_lib/adventures/engine.js','baseline')
        self.put('games/index.html','unrelated old site')
        self.save('baseline');self.baseline=self.git('rev-parse','HEAD').strip()
        self.put('functions/_lib/adventures/engine.js','whole candidate')
        self.put('functions/_lib/adventures/new.js','new addition')
        self.git('rm','-q','games/index.html');self.put('games/index.html','unrelated new site')
        self.save('candidate');self.head=self.git('rev-parse','HEAD').strip()
        spec=importlib.util.spec_from_file_location('release_test',self.repo/'scripts/fiction_release.py')
        self.module=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.module)
        self.report=self.root/'compat.json'
        self.good={'passed':True,'progressedStates':2,'baselineCommit':self.baseline,'candidateCommit':self.head,'baselineFiles':self.module.manifest(self.baseline),'candidateFiles':self.module.manifest(self.head)}
        self.report.write_text(json.dumps(self.good))
    def git(self,*args):
        return subprocess.check_output(['git','-C',str(self.repo),*args],text=True)
    def put(self,name,text):
        path=self.repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
    def save(self,message):
        self.git('add','.');self.git('commit','-qm',message)
    def run_rollback(self,apply=False,report=True):
        from argparse import Namespace
        return self.module.rollback(Namespace(target=self.baseline,apply=apply,compat=str(self.report) if report else None))
    def test_whole_scope_restore_new_commit_and_unrelated_content_preserved(self):
        dry=self.run_rollback();self.assertTrue(dry['dryRun']);self.assertEqual(self.git('rev-parse','HEAD').strip(),self.head)
        result=self.run_rollback(True)
        self.assertFalse(result['deployed']);self.assertEqual(self.git('rev-parse','HEAD^').strip(),self.head)
        self.assertEqual((self.repo/'functions/_lib/adventures/engine.js').read_text(),'baseline')
        self.assertFalse((self.repo/'functions/_lib/adventures/new.js').exists())
        self.assertEqual((self.repo/'games/index.html').read_text(),'unrelated new site')
        self.assertFalse(self.git('status','--porcelain').strip())
    def test_dirty_and_untracked_block_before_mutation(self):
        self.put('untracked.txt','user work')
        with self.assertRaisesRegex(ValueError,'clean'):self.run_rollback(True)
        self.assertEqual(self.git('rev-parse','HEAD').strip(),self.head)
        (self.repo/'untracked.txt').unlink();self.put('games/index.html','edited')
        with self.assertRaisesRegex(ValueError,'clean'):self.run_rollback(True)
    def test_missing_mismatched_empty_and_failed_reports_block(self):
        with self.assertRaisesRegex(ValueError,'required'):self.run_rollback(True,False)
        for changes in [{'passed':False},{'progressedStates':0},{'candidateCommit':self.baseline},{'baselineFiles':{}}]:
            self.report.write_text(json.dumps({**self.good,**changes}))
            with self.assertRaises(ValueError):self.run_rollback(True)
            self.assertEqual(self.git('rev-parse','HEAD').strip(),self.head)
    def test_persistence_change_blocks_automatic_rollback(self):
        self.put('functions/_lib/fiction-service.js','changed persistence')
        self.save('persistence');self.good['candidateCommit']=self.git('rev-parse','HEAD').strip()
        self.good['candidateFiles']=self.module.manifest('HEAD');self.report.write_text(json.dumps(self.good))
        with self.assertRaisesRegex(ValueError,'Persistence'):self.run_rollback(True)
    def test_snapshot_verified_and_no_overwrite(self):
        path=self.root/'snapshot';self.module.snapshot(self.head,path)
        self.assertEqual(self.module.verify_source(path)['commit'],self.head)
        with self.assertRaisesRegex(ValueError,'already exists'):self.module.snapshot(self.head,path)
        (path/'functions/_lib/adventures/engine.js').write_text('tamper')
        with self.assertRaisesRegex(ValueError,'modified'):self.module.verify_source(path)

if __name__=='__main__':unittest.main()
