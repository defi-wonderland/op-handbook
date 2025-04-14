---
id: permissionless-proposals
title: Permissionless Proposals 
sidebar_label: Permissionless Proposals 
---
This section outlines the design for enabling permissionless proposal submissions. The goal is to allow top delegates to submit proposals directly on-chain, without requiring manual approval from the manager, as long as specific automated rules are satisfied.

:::warning
This is still a work in progress.
:::

## Purpose

As we saw in the previous sections, the governance process currently involves manual off-chain steps—drafting proposals on the forum, gathering delegate approvals, and relying on a manager to trigger the on-chain proposal. This creates friction and introduces centralized bottlenecks.

Permissionless proposals aim to shift this flow entirely on-chain, by enforcing all gating requirements (delegate approval, quorum checks, proposal type validation, etc.).

## Summary

The proposed architecture introduces a new contract: `Top100DelegatesProposalValidator`. This contract serves as a pre-validator between proposers and the `OptimismGovernor`.

It enforces:
- Delegate-based approval thresholds
- Valid submission windows
- Proposal type rules via `ProposalTypesConfigurator`
- Distribution limits (for funding-related proposals)

If all requirements are met, the validator forwards the proposal to the Governor, initiating the standard governance voting flow. This system automates the submission pipeline, increases transparency, and maintains safeguards against misuse—without removing the ability for vetoes or emergency halts.

## Architecture and Flow

### `Top100DelegatesProposalValidator`

This contract wraps the `propose()` and `proposeWithModule()` functions and performs validation before forwarding valid proposals to the Governor.

The responsabilities are:

- **Delegate approvals**: Verify that enough top 100 delegates have signed off on a proposal. Minimum voting power and required signers are configurable.
- **Window enforcement**: Ensure that proposals are submitted within a defined “voting cycle window.”
- **Type-aware validation**: Use `ProposalTypesConfigurator` to enforce type-specific constraints like quorum or approval thresholds.
- **Distribution rate limits**: For proposals involving token grants, ensure the requested amount doesn’t exceed a configurable spending cap.
- **Forwarding**: If all validations pass, forward the proposal to `OptimismGovernor`.

## Workflow

1. **Draft proposal**: A delegate creates a draft on the [Optimism Forum](https://gov.optimism.io/) for public feedback.
2. **Finalize proposal**: Once feedback is addressed, the proposer calls `propose(...)` on the `Top100DelegatesProposalValidator`. This emits a `proposalId`, which is added to the forum post and marked as [Final].

![diagram-1.png](diagram-1.png)

3. **Gather delegate approvals**: Other top 100 delegates submit approvals for the on-chain `proposalId`.
4. **Submit for vote**: Once approvals and other criteria are satisfied, anyone can call `moveToVote(...)`. The validator will confirm eligibility and forward the proposal to the Governor for voting.
![diagram-2.png](diagram-2.png)

## Alternatives Considered
- Permissioned configuration (MVP): A designated role (e.g. Foundation) sets thresholds and windows. This is a pragmatic tradeoff, acceptable for the initial rollout while preserving safety guarantees.
- Forum sign-off with signatures: Earlier models considered collecting signed attestations in the forum and verifying them on-chain. This was ultimately rejected in favor of direct on-chain approvals, which are simpler and reduce the chance of human error or coordination delays.

## Risks and Uncertainties
- Centralized configurator: Proposal types and thresholds are currently defined in a permissioned ProposalTypesConfigurator. Future iterations should consider community-driven or decentralized methods for proposal type management.
- Subdelegation edge cases: The system does not currently account for Alligator subdelegations. A delegate could appear in the top 100 through subdelegated voting power, which may already be partially consumed in other votes. This introduces edge cases that may affect proposal eligibility.

:::info reference
The PR is now **open**, read the specs [here](https://github.com/ethereum-optimism/design-docs/pull/260).
:::