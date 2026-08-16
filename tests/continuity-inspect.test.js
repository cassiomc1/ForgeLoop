import assert from "node:assert/strict";
import { test } from "node:test";
import { continuityFinding, continuityIsHealthy } from "../src/core/continuity-observability.js";

test("inspect continuity finding is separate and non-evidence",()=>{
 const finding=continuityFinding({classification:"INCONSISTENT",path:".forgeloop/continuity.json",reasonCodes:["E_CONTINUITY_TASK_MISMATCH"],reasons:["CONTINUITY_TASK_MISMATCH"]});
 assert.equal(finding.code,"continuity-inconsistent");
 assert.equal(finding.path,".forgeloop/continuity.json");
 assert.equal(finding.evidence,undefined);
 assert.match(finding.message,/CONTINUITY_TASK_MISMATCH/);
});
test("absent fresh and complete-inapplicable continuity remain healthy",()=>{
 for(const classification of ["ABSENT","FRESH","NOT_APPLICABLE"]) assert.equal(continuityIsHealthy({classification}),true);
 for(const classification of ["RECONCILIATION_REQUIRED","INCONSISTENT","INVALID"]) assert.equal(continuityIsHealthy({classification}),false);
});
