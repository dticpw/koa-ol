import {nickname} from './table-client.js';
const input=document.getElementById('player-name');input.value=nickname();
input.addEventListener('input',()=>nickname(input.value));
document.querySelectorAll('.table-entry').forEach(a=>a.addEventListener('click',e=>{if(!input.value.trim()){e.preventDefault();input.value='';input.reportValidity();input.focus();}else nickname(input.value);}));
