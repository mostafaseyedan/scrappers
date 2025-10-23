export const cnStatuses = {
  new: "New",
  researching: "Researching",
  pursuing: "Pursuing",
  preApproval: "Pre-Approval",
  submitted: "Submitted",
  negotiation: "Negotiation",
  awarded: "Awarded",
  monitor: "Monitor",
  foia: "FOIA",
  notWon: "Not Won",
  notPursuing: "Not Pursuing",
};

export const cnTypes = [
  {
    key: "erp",
    label: "ERP",
    description: "Includes Infor, SAP, Oracle, Workday, etc.",
  },
  {
    key: "staffing",
    label: "Staffing",
    description: "IT, admin, healthcare, or temp staffing RFPs.",
  },
  {
    key: "itSupport",
    label: "IT Support",
    description: "Managed services, helpdesk, infrastructure, cybersecurity.",
  },
  {
    key: "cloud",
    label: "Cloud / Data / Dev",
    description: "Cloud migration, data analytics, development, AI.",
  },
  {
    key: "other",
    label: "Other Tech",
    description: "Web design, software dev, non-core IT work.",
  },
  {
    key: "facilitiesTelecomHardware",
    label: "Facilities / Telecom / Hardware",
    description: "RFPs focused on phones, cabling, hardware.",
  },
  {
    key: "nonRelevant",
    label: "Non-Relevant",
    description:
      "Education, construction, janitorial, etc., not worth tracking.",
  },
];

export const scrapingSites = {
  biddirect: { name: "BidDirect", status: "active", hasLogin: true },
  bidsync: { name: "BidSync", status: "active", hasLogin: true },
  bonfirehub: { name: "Bonfire", status: "active", hasLogin: true },
  cammnet: { name: "CAMMNET", status: "active", hasLogin: false },
  commbuys: { name: "COMMBUYS", status: "active", hasLogin: false },
  demandstar: { name: "DemandStar", status: "active", hasLogin: true },
  findrfp: { name: "FindRFP", status: "active", hasLogin: true },
  floridabids: { name: "Florida Bids", status: "active", hasLogin: false },
  govdirections: { name: "GovDirections", status: "active", hasLogin: false },
  governmentbidders: {
    name: "Government Bidders",
    status: "active",
    hasLogin: false,
  },
  highergov: { name: "HigherGov", status: "active", hasLogin: true },
  instantmarkets: { name: "InstantMarkets", status: "active", hasLogin: true },
  merx: { name: "MERX", status: "active", hasLogin: true },
  mygovwatch: { name: "MyGovWatch", status: "active", hasLogin: false },
  omniapartners: { name: "OMNIA Partners", status: "active", hasLogin: false },
  publicpurchase: { name: "Public Purchase", status: "active", hasLogin: true },
  rfpmart: { name: "RFPMart", status: "active", hasLogin: false },
  techbids: { name: "TechBids", status: "active", hasLogin: true },
  txsmartbuy: { name: "TX SmartBuy", status: "active", hasLogin: false },
  vendorline: { name: "VendorLine", status: "active", hasLogin: true },
  vendorlink: { name: "VendorLink", status: "active", hasLogin: true },
  vendorregistry: { name: "Vendor Registry", status: "active", hasLogin: true },
};
