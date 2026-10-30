"""Setup, access control and bond rules."""

from tests.direct.conftest import (
    GEN,
    OFFICIAL_URL,
    RULEBOOK,
    addr,
    create_match,
    deploy,
    file_dispute,
)


def test_deploy_seeds_two_rulebooks(direct_deploy):
    contract = deploy(direct_deploy)
    stats = contract.get_stats()

    assert stats["rulebooks"] == 2
    assert stats["matches"] == 0
    assert stats["disputes"] == 0

    book = contract.get_rulebook(RULEBOOK)
    assert book["sport"] == "football"
    assert book["filing_bond"] == str(GEN)
    assert book["appeal_bond"] == str(2 * GEN)


def test_create_match_open_to_any_user(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)

    # Fixture creation is open to any connected user, not only the admin.
    direct_vm.sender = direct_alice
    contract.create_match(
        "match-1",
        RULEBOOK,
        "Test Cup",
        "Rovers",
        "United",
        addr(direct_alice),
        addr(direct_bob),
        "2026-10-29T19:00:00Z",
        OFFICIAL_URL,
    )
    match = contract.get_match("match-1")
    assert match["home_team"] == "Rovers"
    assert match["home_rep"] == addr(direct_alice)


def test_duplicate_match_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)

    with direct_vm.expect_revert("match already exists"):
        create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)


def test_only_registered_rep_can_file(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    direct_vm.value = GEN
    with direct_vm.expect_revert("registered team representative"):
        contract.file_dispute(
            "match-1",
            "GOAL_LINE",
            67,
            "I am a neutral fan and I disagree with the call.",
            "https://cdn.example.com/frame-1.jpg",
        )
    direct_vm.value = 0


def test_filing_requires_exact_bond(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = GEN - 1
    with direct_vm.expect_revert("filing bond must match rulebook"):
        contract.file_dispute(
            "match-1",
            "GOAL_LINE",
            67,
            "The ball crossed the line before the clearance.",
            "https://cdn.example.com/frame-1.jpg",
        )
    direct_vm.value = 0


def test_file_dispute_records_bond_and_respondent(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    file_dispute(contract, direct_vm, direct_alice)

    dispute = contract.get_dispute("match-1#1")
    assert dispute["status"] == "FILED"
    assert dispute["filed_by"] == addr(direct_alice)
    assert dispute["respondent"] == addr(direct_bob)
    assert dispute["filing_bond"] == str(GEN)
    assert dispute["evidence_urls"] == [
        "https://cdn.example.com/frame-1.jpg",
        "https://reports.example.com/incident-1",
    ]


def test_http_evidence_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    create_match(contract, direct_vm, direct_owner, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("evidence URL must use https"):
        contract.file_dispute(
            "match-1",
            "GOAL_LINE",
            67,
            "The ball crossed the line before the clearance.",
            "http://cdn.example.com/frame-1.jpg",
        )
    direct_vm.value = 0
