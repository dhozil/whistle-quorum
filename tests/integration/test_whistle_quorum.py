"""Integration smoke test against a real GenLayer network.

Run with:

    gltest tests/integration -v -s --network studionet

The rulebook created here uses zero bonds and requires two independent
evidence domains. A single evidence URL therefore triggers the contract's
deterministic INCONCLUSIVE downgrade, which keeps the consensus assertion
stable on a live network without depending on model-specific wording.
"""

import pytest

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.contracts.contract import Contract
from gltest.utils import extract_contract_address

pytestmark = pytest.mark.integration


def _addr(account) -> str:
    return account.address


def _deploy(factory, args, account):
    """Deploy and attach without gltest's schema helper.

    ``genlayer-test`` still asks genlayer-py for the schema, and that client
    refuses to fetch schemas for anything that is not ``localnet``. The RPC
    method itself works on StudioNet, so we read it directly.
    """
    receipt = factory.deploy_contract_tx(args=args, account=account)
    assert tx_execution_succeeded(receipt)
    address = extract_contract_address(receipt)
    response = get_gl_client().provider.make_request(
        method="gen_getContractSchema", params=[address]
    )
    return Contract.new(address=address, schema=response["result"], account=account)


def test_setup_and_review(accounts):
    admin = accounts[0]
    home = accounts[1]
    away = accounts[2]

    factory = get_contract_factory("WhistleQuorum")
    contract = _deploy(factory, [_addr(admin)], admin)

    stats = contract.get_stats().call()
    assert int(stats["rulebooks"]) == 2
    assert stats["admin"].lower() == _addr(admin).lower()

    receipt = contract.add_rulebook(
        args=[
            "integration_v1",
            "football",
            "Integration smoke rulebook",
            "A goal counts only when the whole ball crosses the line. "
            "Two independent sources are required for a decision.",
            "",
            0,      # filing bond (keeps the test gasless)
            0,      # appeal bond
            0,      # min confidence
            2,      # min sources -> forces INCONCLUSIVE with one domain
            0,      # counter window
            3600,   # appeal window
            0,      # fee bps
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)

    receipt = contract.create_match(
        args=[
            "it-match-1",
            "integration_v1",
            "Integration Cup",
            "Rovers",
            "United",
            _addr(home),
            _addr(away),
            "2026-10-29T19:00:00Z",
            "",
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)

    home_contract = contract.connect(home)
    receipt = home_contract.file_dispute(
        args=[
            "it-match-1",
            "GOAL_LINE",
            67,
            "The ball crossed the line before the clearance; the goal should stand.",
            "https://example.com",
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)

    dispute = contract.get_dispute(args=["it-match-1#1"]).call()
    assert dispute["status"] == "FILED"
    assert dispute["evidence_urls"] == ["https://example.com"]

    receipt = contract.review_dispute(args=["it-match-1#1"]).transact(
        wait_transaction_status="FINALIZED"
    )
    assert tx_execution_succeeded(receipt)

    dispute = contract.get_dispute(args=["it-match-1#1"]).call()
    assert dispute["status"] == "DECIDED"
    assert dispute["outcome"] == "INCONCLUSIVE"
    assert dispute["recommended_action"] == "NO_CHANGE"
    assert len(dispute["evidence_hashes"]) == 1
    assert dispute["evidence_hashes"][0]["sha256"]
    assert dispute["reviewed_at"] > 0
