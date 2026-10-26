
import test from 'node:test';
import assert from 'node:assert/strict';
import {DebouncedWriter} from '../dist/js/autosave.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('autosave agrupa cliques e mantém zero válido',async()=>{const sent=[],status=[];const w=new DebouncedWriter({delay:15,save:async v=>sent.push(v),status:s=>status.push(s)});w.queue([1]);w.queue([2]);w.queue([0]);await pause(40);assert.deepEqual(sent,[[0]]);assert.equal(w.dirty,false);assert.equal(status.at(-1),'saved');});
test('autosave só confirma após resposta e envia valor mais recente em sequência',async()=>{const sent=[],persisted=[];let release;const w=new DebouncedWriter({delay:1000,persist:v=>persisted.push(v),save:async v=>{sent.push(v);if(sent.length===1)await new Promise(r=>release=r);}});w.queue([10]);const saving=w.flush();assert.equal(w.dirty,true);assert.deepEqual(persisted.at(-1),[10]);w.queue([20]);release();await saving;assert.deepEqual(sent,[[10],[20]]);assert.equal(w.dirty,false);assert.equal(persisted.at(-1),null);});
test('falha conserva rascunho e permite repetir sem declarar salvo',async()=>{const statuses=[];let fail=true,last;const w=new DebouncedWriter({delay:1000,persist:v=>last=v,status:s=>statuses.push(s),save:async()=>{if(fail)throw Error('offline');}});w.queue([5]);await assert.rejects(w.flush(),/offline/);assert.equal(w.dirty,true);assert.deepEqual(last,[5]);assert.equal(statuses.includes('saved'),false);fail=false;await w.flush();assert.equal(last,null);});
test('entrada inválida cancela envio agendado',async()=>{const sent=[];let draft;const w=new DebouncedWriter({delay:15,persist:v=>draft=v,save:async v=>sent.push(v)});w.queue([3]);w.invalidate();await pause(35);assert.deepEqual(sent,[]);assert.deepEqual(draft,[3]);});

