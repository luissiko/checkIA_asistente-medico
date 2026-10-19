import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceGate} from '../src/paso23-choice.mjs';
test('un clic selecciona; clics repetidos no duplican una respuesta pendiente',()=>{
 const gate=createChoiceGate(),answers=[];
 assert.equal(gate.select('si',x=>answers.push(x)),true);
 assert.deepEqual(answers,['si']);assert.equal(gate.select('si',x=>answers.push(x)),false);
 assert.deepEqual(answers,['si']);gate.reset();assert.equal(gate.select('no',x=>answers.push(x)),true);assert.deepEqual(answers,['si','no']);
});
test('una operación en curso no acepta selección; un error permite reintentar',()=>{
 const gate=createChoiceGate(),answers=[];assert.equal(gate.select('a',x=>answers.push(x),true),false);assert.equal(answers.length,0);
 gate.select('a',x=>answers.push(x));gate.reset();gate.select('a',x=>answers.push(x));assert.equal(answers.length,2);
});
