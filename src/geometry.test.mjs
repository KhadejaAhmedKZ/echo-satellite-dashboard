import {test} from 'node:test';import assert from 'node:assert/strict';import {position,STATION,validate} from './geometry.mjs';
test('zenith is directly above Abu Dhabi',()=>{const p=position({elevation:90,azimuth:0,range:550});assert.ok(Math.abs(p.lat-STATION.lat)<1e-8);assert.ok(Math.abs(p.lng-STATION.lng)<1e-8);assert.ok(Math.abs(p.altitude-550/6371)<1e-8)});
test('invalid or below horizon observations have no invented positions',()=>{assert.equal(position({elevation:-1,azimuth:0,range:500}),null);assert.equal(position({elevation:30}),null)});
test('east-facing observation moves east',()=>{assert.ok(position({elevation:30,azimuth:90,range:1000}).lng>STATION.lng)});
test('reject invalid status',()=>assert.throws(()=>validate({status:'fake'})));
