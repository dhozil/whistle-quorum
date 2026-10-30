"""Appeals, finality and bond settlement."""

from tests.direct.conftest import (
    APPEAL_URL,
    COUNTER_URL,
    GEN,
    REPORT_URL,
    addr,
    appeal,
    create_match,
    deploy,
    file_dispute,
    register_llm_mock,
    register_web_mocks,
    review,
    submit_counter,
    verdict,
)


def _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    file_dispute(contract, direct_vm, direct_alice)
    submit_counter(contract, direct_vm, direct_bob)
    review(contract, direct_vm)
    return contract


def test_winner_cannot_appeal_own_win(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("not eligible to appeal"):
        contract.appeal("match-1#1", APPEAL_URL, "I want to appeal even though I won.")
    direct_vm.value = 0


def test_appeal_requires_new_evidence(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("at least one new evidence URL"):
        contract.appeal("match-1#1", COUNTER_URL, "The same angle proves nothing new.")
    direct_vm.value = 0


def test_appeal_requires_exact_bond(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    with direct_vm.expect_revert("appeal bond must match rulebook"):
        contract.appeal("match-1#1", APPEAL_URL, "The new angle shows a different outcome.")
    direct_vm.value = 0


def test_appeal_window_closes(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    direct_vm.warp("2026-11-02T12:00:00Z")

    direct_vm.sender = direct_bob
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("appeal window closed"):
        contract.appeal("match-1#1", APPEAL_URL, "The new angle shows a different outcome.")
    direct_vm.value = 0


def test_review_appeal_blocked_before_window_closes(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    direct_vm.warp("2026-10-30T12:00:00Z")
    appeal(contract, direct_vm, direct_bob)

    # An appeal filed inside the window must not be resolved before the window
    # closes: the final verdict may not bypass the deadline protection.
    direct_vm.clear_mocks()
    register_web_mocks(direct_vm, include_appeal=True)
    register_llm_mock(direct_vm)
    with direct_vm.expect_revert("appeal window is still open"):
        contract.review_appeal("match-1#1")


def test_appeal_reversed_then_settlement(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    direct_vm.warp("2026-10-30T12:00:00Z")
    appeal(contract, direct_vm, direct_bob)

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "APPEALED"
    assert dispute["appealed_by"] == addr(direct_bob)
    assert dispute["appeal_bond"] == str(2 * GEN)

    # The final verdict may only be rendered once the appeal window closed.
    direct_vm.warp("2026-11-05T12:00:00Z")
    direct_vm.clear_mocks()
    register_web_mocks(direct_vm, include_appeal=True)
    register_llm_mock(
        direct_vm,
        verdict(
            outcome="CLAIM_REJECTED",
            recommended_action="NO_CHANGE",
            confidence=92,
            findings=["Frame 3 shows the ball never fully crossed the line."],
        ),
    )
    contract.review_appeal("match-1#1")

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "FINAL"
    assert dispute["appeal_result"] == "REVERSED"
    assert dispute["final_outcome"] == "CLAIM_REJECTED"
    assert dispute["final_action"] == "NO_CHANGE"

    contract.settle("match-1#1")
    dispute = contract.get_dispute("match-1#1")
    assert dispute["settled"] is True
    assert dispute["winner"] == addr(direct_bob)
    # pot = 3 GEN, fee = 5% -> 2.85 GEN
    assert dispute["payout"] == str(285 * 10**16)
    assert contract.get_claimable(addr(direct_bob)) == str(285 * 10**16)
    assert contract.get_claimable(addr(direct_owner)) == str(15 * 10**16)

    rep = contract.get_reputation(addr(direct_bob))
    assert rep["wins"] == 1
    assert rep["appeals_won"] == 1
    assert contract.get_reputation(addr(direct_alice))["losses"] == 1


def test_appeal_confirmed_keeps_original(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    direct_vm.warp("2026-10-30T12:00:00Z")
    appeal(contract, direct_vm, direct_bob)

    # The final verdict may only be rendered once the appeal window closed.
    direct_vm.warp("2026-11-05T12:00:00Z")
    direct_vm.clear_mocks()
    register_web_mocks(direct_vm, include_appeal=True)
    register_llm_mock(
        direct_vm,
        verdict(
            outcome="CLAIM_UPHELD",
            recommended_action="AWARD_GOAL",
            confidence=88,
            findings=["The new angle confirms the ball crossed the line."],
        ),
    )
    contract.review_appeal("match-1#1")

    dispute = contract.get_dispute("match-1#1")
    assert dispute["appeal_result"] == "CONFIRMED"
    assert dispute["final_outcome"] == "CLAIM_UPHELD"
    assert dispute["final_action"] == "AWARD_GOAL"

    contract.settle("match-1#1")
    assert contract.get_claimable(addr(direct_alice)) == str(285 * 10**16)
    assert contract.get_reputation(addr(direct_bob))["appeals_lost"] == 1


def test_finalize_after_window_without_appeal(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    with direct_vm.expect_revert("appeal window is still open"):
        contract.finalize("match-1#1")

    direct_vm.warp("2026-11-02T12:00:00Z")
    contract.finalize("match-1#1")

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "FINAL"
    assert dispute["final_outcome"] == "CLAIM_UPHELD"
    assert dispute["final_action"] == "AWARD_GOAL"


def test_inconclusive_refunds_both_bonds(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    file_dispute(contract, direct_vm, direct_alice)
    submit_counter(contract, direct_vm, direct_bob)
    review(contract, direct_vm, verdict(confidence=35, evidence_quality="WEAK"))

    direct_vm.warp("2026-11-02T12:00:00Z")
    contract.finalize("match-1#1")
    contract.settle("match-1#1")

    dispute = contract.get_dispute("match-1#1")
    assert dispute["final_outcome"] == "INCONCLUSIVE"
    assert dispute["winner"] == "0x0000000000000000000000000000000000000000"
    assert dispute["payout"] == "0"
    assert contract.get_claimable(addr(direct_alice)) == str(GEN)
    assert contract.get_claimable(addr(direct_bob)) == "0"
    assert contract.get_claimable(addr(direct_owner)) == "0"


def test_settle_is_idempotent_guarded(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)
    direct_vm.warp("2026-11-02T12:00:00Z")
    contract.finalize("match-1#1")
    contract.settle("match-1#1")

    with direct_vm.expect_revert("already settled"):
        contract.settle("match-1#1")


def test_can_appeal_view(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _decided(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob)

    assert contract.can_appeal("match-1#1", addr(direct_bob)) is True
    assert contract.can_appeal("match-1#1", addr(direct_alice)) is False

    direct_vm.warp("2026-11-02T12:00:00Z")
    assert contract.can_appeal("match-1#1", addr(direct_bob)) is False
