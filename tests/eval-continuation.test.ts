import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {datasetSchema,type EvalReport,type EvalResult} from '../src/lib/evals/schemas';
import {unfinishedCases} from '../src/lib/evals/continuation';
const raw=readFileSync('evals/cases.json','utf8');
const cases=datasetSchema.parse(JSON.parse(raw));
const expected={suite:'payment-disputes-v2-dev',hash:createHash('sha256').update(raw).digest('hex'),provider:'gemini',model:'gemini-3.5-flash-lite'};
const report={suite_name:expected.suite,suite_sha256:expected.hash,provider:expected.provider,model:expected.model,dataset_size:40,results:[]} as unknown as EvalReport;
function result(index:number,fields:Partial<EvalResult>={}):EvalResult {
 return {id:cases[index].id,attempted:true,passed:true,infrastructure_error:null,...fields} as EvalResult;
}
describe('budget-safe evaluation continuation',()=>{
 it('preserves completed passes and real failures while selecting blocked, skipped and missing cases',()=>{
  const previous={...report,results:[result(0),result(1,{passed:false}),result(2,{passed:false,infrastructure_error:'Daily allowance'}),result(3,{passed:false,attempted:false,infrastructure_error:'Skipped'})]};
  const remaining=unfinishedCases(cases,previous,expected);
  expect(remaining).toHaveLength(38);
  expect(remaining.map(x=>x.id)).not.toContain(cases[0].id);
  expect(remaining.map(x=>x.id)).not.toContain(cases[1].id);
  expect(remaining.slice(0,2).map(x=>x.id)).toEqual([cases[2].id,cases[3].id]);
 });
 it('rejects incompatible datasets/models and ambiguous report IDs',()=>{
  expect(()=>unfinishedCases(cases,{...report,model:'another-model'},expected)).toThrow('same dataset');
  expect(()=>unfinishedCases(cases,{...report,suite_sha256:'changed'},expected)).toThrow('same dataset');
  expect(()=>unfinishedCases(cases,{...report,results:[result(0),result(0)]},expected)).toThrow('duplicate');
 });
});
