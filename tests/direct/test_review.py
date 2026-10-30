"""Consensus review behaviour and validator agreement."""

import json

from tests.direct.conftest import (
    COUNTER_URL,
    FRAME_URL,
    GEN,
    OFFICIAL_URL,
    REPORT_URL,
    addr,
    create_match,
    deploy,
    file_dispute,
    register_llm_mock,
    register_web_mocks,
    review,
    submit_counter,
    verdict,
)


def _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    file_dispute(contract, direct_vm, direct_alice)
    submit_counter(contract, direct_vm, direct_bob)
    return contract


def test_review_stores_verdict(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "DECIDED"
    assert dispute["outcome"] == "CLAIM_UPHELD"
    assert dispute["recommended_action"] == "AWARD_GOAL"
    assert dispute["confidence"] == 86
    assert dispute["evidence_quality"] == "STRONG"
    assert dispute["manipulation_suspected"] is False
    assert len(dispute["evidence_hashes"]) == 4
    assert dispute["findings"][0].startswith("The ball is fully behind")


def test_validator_agrees_with_same_evidence(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    assert direct_vm.run_validator() is True


def test_validator_rejects_conflicting_decision(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    direct_vm.clear_mocks()
    register_web_mocks(direct_vm)
    register_llm_mock(
        direct_vm,
        verdict(
            outcome="CLAIM_REJECTED",
            recommended_action="NO_CHANGE",
            confidence=81,
            findings=["The available frame is inconclusive."],
        ),
    )

    assert direct_vm.run_validator() is False


def test_validator_ignores_free_text_differences(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    direct_vm.clear_mocks()
    register_web_mocks(direct_vm)
    register_llm_mock(
        direct_vm,
        verdict(
            findings=["A completely different wording of the same finding."],
        ),
    )

    assert direct_vm.run_validator() is True


def test_validator_requires_corroboration_agreement(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    direct_vm.clear_mocks()
    register_web_mocks(direct_vm)
    register_llm_mock(direct_vm, verdict(corroboration=False, contradiction=False))
    assert direct_vm.run_validator() is False


def test_validator_requires_contradiction_agreement(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    direct_vm.clear_mocks()
    register_web_mocks(direct_vm)
    register_llm_mock(direct_vm, verdict(contradiction=True))
    assert direct_vm.run_validator() is False


def test_validator_requires_source_agreement(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    direct_vm.clear_mocks()
    register_web_mocks(direct_vm)
    register_llm_mock(direct_vm, verdict(sources=[FRAME_URL]))
    assert direct_vm.run_validator() is False


def test_decisive_verdict_requires_allowlisted_source(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    contract.add_rulebook(
        "narrow_v1",
        "football",
        "Narrow allowlist rulebook",
        "Award a goal only when the whole ball crossed the line. When the decisive frame is unavailable the review must be INCONCLUSIVE.",
        "official.example.com",
        GEN,
        2 * GEN,
        70,
        1,
        0,
        72 * 3600,
        500,
    )
    contract.create_match(
        "match-1",
        "narrow_v1",
        "Test Cup",
        "Rovers",
        "United",
        addr(direct_alice),
        addr(direct_bob),
        "2026-10-29T19:00:00Z",
        OFFICIAL_URL,
    )
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.file_dispute(
        "match-1",
        "GOAL_LINE",
        67,
        "The ball crossed the line before the clearance; the goal should stand.",
        OFFICIAL_URL,
    )
    direct_vm.value = 0
    direct_vm.sender = direct_bob
    contract.submit_counter_evidence("match-1#1", OFFICIAL_URL, "The angle is deceptive.")
    # The decisive claim cites a frame domain that the rulebook does not allow,
    # so the verdict must not be treated as binding even though the frame was fetched.
    review(contract, direct_vm, verdict(sources=[FRAME_URL]))

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "DECIDED"
    assert dispute["outcome"] == "INCONCLUSIVE"
    assert dispute["recommended_action"] == "NO_CHANGE"


def test_low_confidence_is_downgraded_to_inconclusive(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm, verdict(confidence=42, evidence_quality="WEAK"))

    dispute = contract.get_dispute("match-1#1")
    assert dispute["outcome"] == "INCONCLUSIVE"
    assert dispute["recommended_action"] == "NO_CHANGE"
    assert dispute["confidence"] == 42


def test_insufficient_quality_is_downgraded(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm, verdict(evidence_quality="INSUFFICIENT"))

    dispute = contract.get_dispute("match-1#1")
    assert dispute["outcome"] == "INCONCLUSIVE"
    assert dispute["recommended_action"] == "NO_CHANGE"


def test_no_usable_evidence_reverts(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.mock_web(r"https://official\.example\.com/match-1", {"status": 404, "body": ""})
    direct_vm.mock_web(r"https://cdn\.example\.com/frame-1\.jpg", {"status": 404, "body": ""})
    direct_vm.mock_web(r"https://reports\.example\.com/incident-1", {"status": 404, "body": ""})
    direct_vm.mock_web(r"https://cdn\.example\.com/frame-2\.jpg", {"status": 404, "body": ""})
    register_llm_mock(direct_vm)

    with direct_vm.expect_revert("no usable public evidence"):
        contract.review_dispute("match-1#1")


def test_review_is_not_permissioned(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    register_web_mocks(direct_vm)
    register_llm_mock(direct_vm)
    direct_vm.sender = direct_charlie
    contract.review_dispute("match-1#1")

    assert contract.get_dispute("match-1#1")["status"] == "DECIDED"


def test_counter_evidence_only_once(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("already submitted"):
        contract.submit_counter_evidence("match-1#1", "https://cdn.example.com/frame-2.jpg", "Again")


def test_filer_cannot_submit_counter_evidence(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    file_dispute(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("only the respondent"):
        contract.submit_counter_evidence("match-1#1", COUNTER_URL, "I agree with myself")


def test_hashes_cover_every_fetched_artifact(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _prepared(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    review(contract, direct_vm)

    hashes = contract.get_dispute("match-1#1")["evidence_hashes"]
    urls = [entry["url"] for entry in hashes]
    assert "https://official.example.com/match-1" in urls
    assert FRAME_URL in urls
    assert REPORT_URL in urls
    assert COUNTER_URL in urls
    assert all(len(entry["sha256"]) == 64 for entry in hashes)
