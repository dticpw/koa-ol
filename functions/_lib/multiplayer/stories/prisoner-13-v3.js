import {story as source} from '../story.js';
import {ApiError} from '../../fiction-service.js';
const operatingFacts=[...source.operatingFacts,
 '原稿 Meeting Prisoner 13 / R11 / Roleplaying Prisoner 13：目标本人通常也会在天气允许时参加日常放风，并可能做倒便桶、餐后清扫等杂务；这些是牢外接触的实际途径，不只剩正式会面。一般登记与押送是背景流程，可随正常工作安排承接。没有已发生的恶劣天气、惩戒、警报等具体原因，不能凭空把目标从当天全部放风或杂务名单排除，再把新增审批当作她离牢的必需前提。若只知道眼前批次尚无她，应保留可询问、观察或等待正常时段的机会，不能推断全天禁止。'
];
// The published v2 material is immutable; this adapter owns v3 scenario semantics.
export const story={...structuredClone(source),revision:'prisoner-13-v3',start:'dock',operatingFacts,
 opportunities:{...source.opportunities,yard:source.opportunities.yard+' 目标本人同样有正常放风和杂务的离牢机会。只缺时刻信息时可通过观察或正常询问补足，不凭空取消她当天全部安排。'},
 progressSchema:{type:'object',properties:{keyCopied:{type:'boolean'}},required:['keyCopied'],additionalProperties:false},
 initialProgress:{keyCopied:false},
 retrievalAliases:[['厨师长','Tiny Toulaine','图莱恩'],['典狱长','玛尔塔','马桑尼斯'],['13号','十三号','科尔达','目标囚犯'],['账册','名册','记录簿'],['归还','还回','物归原主','借物'],['许可','准许','同意','获准']],
 initialItems:members=>members.flatMap(p=>[{id:p.id+'_coat',name:'厨工制服与保暖外套',owner:p.id,condition:'完好，穿着。'},{id:p.id+'_tools',name:'随身工具包',owner:p.id,condition:'普通绳索、纸笔、火种盒；没有预设法术。'}]),
 cast:[
  {id:'toulaine',place:'kitchen',name:'厨师长',goal:'按时把饭送到，少出差错',concern:'工作被耽误',leeway:'可以安排合理的帮工、送餐与休息，不代替守卫开牢门'},
  {id:'warden',place:'warden',name:'典狱长',goal:'监狱安全、依法处置',concern:'无依据放人或失去监管',leeway:'回应证据与可信理由，可安排受监督会见'},
  {id:'prisoner',place:'cells',name:'13号囚犯',goal:'取得可用的情报',concern:'失去监狱的庇护',leeway:'有条件交换，不想被劫走'}
 ],
 canon:operatingFacts.map((text,i)=>({id:'operation-'+i,text,source:'Prisoner 13 / Prison Features, Distractions, Patrol Routes'})),
 validateProgress(before,proposal,scene){
  if(typeof proposal.progress?.keyCopied!=='boolean')throw new ApiError(503,'目标进度格式无效。','ruling_invalid');
  if(!before.keyCopied&&proposal.progress.keyCopied&&!['cells','yard','meeting'].includes(scene.location)&&!['cells','yard','meeting'].includes(proposal.destination))throw new ApiError(503,'目标进度缺少实际接触过程。','ruling_invalid');
  if(proposal.ended&&proposal.destination!=='escape')throw new ApiError(503,'尚未实际离场。','ruling_invalid');
  return {keyCopied:before.keyCopied||proposal.progress.keyCopied};
 }
};
