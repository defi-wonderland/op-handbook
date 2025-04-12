import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'welcome',
    {
      type: 'category',
      label: 'Stack',
      items: [
        'stack/overview',
        'stack/previous-knowledge',
        'stack/op-stack',
        'stack/deposit-flow',
        'stack/withdrawal-flow',
        'stack/evm-vs-op',
        'stack/precompiles-and-predeploys',
        'stack/preinstalls',
        'stack/bye',
      ],
    },
    {
      type: 'category',
      label: 'Governance',
      items: [
        'governance/overview',
      ],
    },
    {
      type: 'category',
      label: 'Interop',
      items: [
        'interoperability/overview',
      ],
    },
    {
      type: 'category',
      label: 'Processes',
      items: [
        'processes/overview',
      ],
    },
  ],
};

export default sidebars;
