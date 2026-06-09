-- Intelligence Laboratory durable store (spec item 19): 26 tables for
-- causal graphs, counterfactuals, experiments, hypotheses, proof packets,
-- logic rules, Catholic ontology, claims/evidence, epistemic history,
-- strategy tournaments, benchmarks, brain versions, the digital twin,
-- capability proposals, curriculum, adversarial cases, and architecture
-- integrity reports. Loose-coupled audit store (no FKs); SQL extracted
-- from `prisma migrate diff` so it matches the schema exactly.

CREATE TABLE "LabCausalGraph" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "brainCallId" TEXT,
    "factorCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCausalGraph_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCausalFactor" (
    "id" TEXT NOT NULL,
    "graphId" TEXT,
    "factor" TEXT NOT NULL,
    "effect" TEXT,
    "mechanism" TEXT,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intervention" TEXT,
    "leverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCausalFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCounterfactualRun" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "decisionId" TEXT,
    "brainCallId" TEXT,
    "actualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestAlternative" TEXT,
    "regret" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCounterfactualRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabExperimentPlan" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "question" TEXT NOT NULL,
    "metric" TEXT,
    "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "samplePerGroup" INTEGER NOT NULL DEFAULT 0,
    "bounded" BOOLEAN NOT NULL DEFAULT true,
    "publishes" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DESIGNED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabExperimentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabExperimentResult" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "leader" TEXT,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conclusive" BOOLEAN NOT NULL DEFAULT false,
    "lesson" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabExperimentResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabHypothesis" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "hkey" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedResult" TEXT,
    "experimentPlan" TEXT,
    "successCriteria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "verdict" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabHypothesis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabProofPacket" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "contentId" TEXT,
    "contentType" TEXT,
    "claim" TEXT,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "conditionsSatisfied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditionsFailed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "recommendedAction" TEXT,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "proven" BOOLEAN NOT NULL DEFAULT false,
    "whatWouldChange" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabProofPacket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabLogicRule" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabLogicRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabRuleEvaluation" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "contentId" TEXT,
    "ruleId" TEXT NOT NULL,
    "applies" BOOLEAN NOT NULL DEFAULT true,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabRuleEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCatholicOntologyNode" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT,
    "contentId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCatholicOntologyNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCatholicOntologyEdge" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "objectId" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCatholicOntologyEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabClaimRecord" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "contentId" TEXT,
    "text" TEXT NOT NULL,
    "subject" TEXT,
    "predicate" TEXT,
    "value" TEXT,
    "source" TEXT,
    "authorityLevel" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "epistemicStatus" TEXT NOT NULL DEFAULT 'UNCERTAIN',
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "whatWouldChange" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabClaimRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "authorityLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabClaimEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabEpistemicStatusHistory" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabEpistemicStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabStrategyCandidate" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "name" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabStrategyCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabStrategyTournament" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "winner" TEXT,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabStrategyTournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabBenchmarkCase" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabBenchmarkCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabBenchmarkRun" (
    "id" TEXT NOT NULL,
    "brainVersion" TEXT,
    "overall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weakest" JSONB NOT NULL DEFAULT '[]',
    "regression" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabBenchmarkRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabBrainVersionScore" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabBrainVersionScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabDigitalTwinScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabDigitalTwinScenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabDigitalTwinRun" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "touchesProduction" BOOLEAN NOT NULL DEFAULT false,
    "fidelity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabDigitalTwinRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCapabilityProposal" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "developerRequestId" TEXT,
    "name" TEXT NOT NULL,
    "problem" TEXT,
    "expectedIntelligenceGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedGrowthGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedSafetyGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabCapabilityProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCurriculumCase" (
    "id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCurriculumCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabCurriculumRun" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "overall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillScores" JSONB NOT NULL DEFAULT '{}',
    "plateaus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCurriculumRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabAdversarialCase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetGate" TEXT,
    "held" BOOLEAN NOT NULL DEFAULT false,
    "regressionRequested" BOOLEAN NOT NULL DEFAULT false,
    "developerRequestId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabAdversarialCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabArchitectureIntegrityReport" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "integrity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "clean" BOOLEAN NOT NULL DEFAULT true,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabArchitectureIntegrityReport_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "LabCausalGraph_passId_idx" ON "LabCausalGraph"("passId");
CREATE INDEX "LabCausalGraph_createdAt_idx" ON "LabCausalGraph"("createdAt");
CREATE INDEX "LabCausalFactor_graphId_idx" ON "LabCausalFactor"("graphId");
CREATE INDEX "LabCausalFactor_factor_idx" ON "LabCausalFactor"("factor");
CREATE INDEX "LabCounterfactualRun_passId_idx" ON "LabCounterfactualRun"("passId");
CREATE INDEX "LabCounterfactualRun_decisionId_idx" ON "LabCounterfactualRun"("decisionId");
CREATE INDEX "LabCounterfactualRun_createdAt_idx" ON "LabCounterfactualRun"("createdAt");
CREATE INDEX "LabExperimentPlan_status_idx" ON "LabExperimentPlan"("status");
CREATE INDEX "LabExperimentPlan_createdAt_idx" ON "LabExperimentPlan"("createdAt");
CREATE INDEX "LabExperimentResult_planId_idx" ON "LabExperimentResult"("planId");
CREATE INDEX "LabExperimentResult_createdAt_idx" ON "LabExperimentResult"("createdAt");
CREATE INDEX "LabHypothesis_status_idx" ON "LabHypothesis"("status");
CREATE INDEX "LabHypothesis_hkey_idx" ON "LabHypothesis"("hkey");
CREATE INDEX "LabProofPacket_passId_idx" ON "LabProofPacket"("passId");
CREATE INDEX "LabProofPacket_contentId_idx" ON "LabProofPacket"("contentId");
CREATE INDEX "LabProofPacket_recommendedAction_idx" ON "LabProofPacket"("recommendedAction");
CREATE INDEX "LabProofPacket_createdAt_idx" ON "LabProofPacket"("createdAt");
CREATE UNIQUE INDEX "LabLogicRule_ruleId_key" ON "LabLogicRule"("ruleId");
CREATE INDEX "LabRuleEvaluation_ruleId_idx" ON "LabRuleEvaluation"("ruleId");
CREATE INDEX "LabRuleEvaluation_ok_idx" ON "LabRuleEvaluation"("ok");
CREATE INDEX "LabRuleEvaluation_contentId_idx" ON "LabRuleEvaluation"("contentId");
CREATE INDEX "LabCatholicOntologyNode_entityType_idx" ON "LabCatholicOntologyNode"("entityType");
CREATE INDEX "LabCatholicOntologyNode_contentId_idx" ON "LabCatholicOntologyNode"("contentId");
CREATE INDEX "LabCatholicOntologyEdge_subjectType_idx" ON "LabCatholicOntologyEdge"("subjectType");
CREATE INDEX "LabCatholicOntologyEdge_relation_idx" ON "LabCatholicOntologyEdge"("relation");
CREATE INDEX "LabClaimRecord_epistemicStatus_idx" ON "LabClaimRecord"("epistemicStatus");
CREATE INDEX "LabClaimRecord_contentId_idx" ON "LabClaimRecord"("contentId");
CREATE INDEX "LabClaimEvidence_claimId_idx" ON "LabClaimEvidence"("claimId");
CREATE INDEX "LabClaimEvidence_kind_idx" ON "LabClaimEvidence"("kind");
CREATE INDEX "LabEpistemicStatusHistory_claimId_idx" ON "LabEpistemicStatusHistory"("claimId");
CREATE INDEX "LabEpistemicStatusHistory_createdAt_idx" ON "LabEpistemicStatusHistory"("createdAt");
CREATE INDEX "LabStrategyCandidate_tournamentId_idx" ON "LabStrategyCandidate"("tournamentId");
CREATE INDEX "LabStrategyCandidate_name_idx" ON "LabStrategyCandidate"("name");
CREATE INDEX "LabStrategyTournament_passId_idx" ON "LabStrategyTournament"("passId");
CREATE INDEX "LabStrategyTournament_createdAt_idx" ON "LabStrategyTournament"("createdAt");
CREATE UNIQUE INDEX "LabBenchmarkCase_task_key" ON "LabBenchmarkCase"("task");
CREATE INDEX "LabBenchmarkRun_brainVersion_idx" ON "LabBenchmarkRun"("brainVersion");
CREATE INDEX "LabBenchmarkRun_createdAt_idx" ON "LabBenchmarkRun"("createdAt");
CREATE INDEX "LabBrainVersionScore_version_idx" ON "LabBrainVersionScore"("version");
CREATE INDEX "LabBrainVersionScore_createdAt_idx" ON "LabBrainVersionScore"("createdAt");
CREATE INDEX "LabDigitalTwinScenario_name_idx" ON "LabDigitalTwinScenario"("name");
CREATE INDEX "LabDigitalTwinRun_passId_idx" ON "LabDigitalTwinRun"("passId");
CREATE INDEX "LabDigitalTwinRun_createdAt_idx" ON "LabDigitalTwinRun"("createdAt");
CREATE INDEX "LabCapabilityProposal_status_idx" ON "LabCapabilityProposal"("status");
CREATE INDEX "LabCapabilityProposal_name_idx" ON "LabCapabilityProposal"("name");
CREATE INDEX "LabCurriculumCase_skill_idx" ON "LabCurriculumCase"("skill");
CREATE INDEX "LabCurriculumRun_createdAt_idx" ON "LabCurriculumRun"("createdAt");
CREATE INDEX "LabAdversarialCase_targetGate_idx" ON "LabAdversarialCase"("targetGate");
CREATE INDEX "LabAdversarialCase_held_idx" ON "LabAdversarialCase"("held");
CREATE INDEX "LabArchitectureIntegrityReport_clean_idx" ON "LabArchitectureIntegrityReport"("clean");
CREATE INDEX "LabArchitectureIntegrityReport_createdAt_idx" ON "LabArchitectureIntegrityReport"("createdAt");
