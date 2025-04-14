---
id: deposit-flow
title: Deposit Flow
sidebar_label: Deposit Flow
---
# Deposit Flow

:::info Reference
Find the full documentation [here](https://docs.optimism.io/stack/transactions/deposit-flow).
:::

We have a user that deposits an ERC-20, for doing that it will interact with the [`L1StandardBridge`](https://github.com/ethereum-optimism/optimism/blob/cd2b0c13ca993d95422c447fce0e14227b50a5cb/packages/contracts-bedrock/src/L1/L1StandardBridge.sol) that will communicate with the [`L1CrossDomainMessenger`](https://github.com/ethereum-optimism/optimism/blob/cd2b0c13ca993d95422c447fce0e14227b50a5cb/op-e2e/bindings/l1crossdomainmessenger.go#L63), which will communicate with the [`OptimismPortal`](https://github.com/ethereum-optimism/optimism/blob/cd2b0c13ca993d95422c447fce0e14227b50a5cb/packages/contracts-bedrock/src/L1/OptimismPortal2.sol) —calling the function `depositTransaction(address _to, uint256 _value, uint64 _gasLimit, bool _isCreation, bytes memory _data) public payable metered(_gasLimit)`

Now, all the L2 nodes will be listening to the deposit events, and the sequencer 👷‍♂️ will decide when to include it, we use the `OptimismPortal` for this. The events are not going to be processed immediately, to reduce the chances of reorgs.

:::info What happen if the sequencer is down?
Even when the sequencer is down; deposits are forced to be included “eventually”. Currently the force-deposit window is done after 12h.
:::

After waiting, it will pack the information into a transaction that will go to the [`L2CrossDomainMessenger`](https://github.com/ethereum-optimism/optimism/blob/cd2b0c13ca993d95422c447fce0e14227b50a5cb/packages/contracts-bedrock/src/L2/L2CrossDomainMessenger.sol) , that interacts with [`L2StandardBridge`](https://github.com/ethereum-optimism/optimism/blob/cd2b0c13ca993d95422c447fce0e14227b50a5cb/packages/contracts-bedrock/src/L2/L2StandardBridge.sol#L17) and woho! the user gets its ERC-20s.

![deposit.png](img/deposit-flow.png)

:::info Reference
For further reference about smart contracts see [L2BEAT OP Mainnet](https://l2beat.com/scaling/projects/op-mainnet#contracts)
:::

