/** Static content for the demo organization. Kept separate from seed logic. */

export const DEMO_ORG = { name: 'Demo Realty', slug: 'demo-realty', industry: 'REAL_ESTATE' };

export const DEMO_USERS = [
  { name: 'Rajesh Khanna', email: 'owner@demorealty.test', role: 'OWNER', phone: '+919810000001' },
  { name: 'Meera Iyer', email: 'admin@demorealty.test', role: 'ADMIN', phone: '+919810000002' },
  { name: 'Sanjay Rao', email: 'manager@demorealty.test', role: 'SALES_MANAGER', phone: '+919810000003' },
  { name: 'Amit Sharma', email: 'sales@demorealty.test', role: 'SALESPERSON', phone: '+919810000004' },
  { name: 'Pooja Nair', email: 'pooja@demorealty.test', role: 'SALESPERSON', phone: '+919810000005' },
  { name: 'Vikas Malhotra', email: 'vikas@demorealty.test', role: 'SALESPERSON', phone: '+919810000006' },
  { name: 'Divya Menon', email: 'divya@demorealty.test', role: 'SALESPERSON', phone: '+919810000007' },
];

export const DEMO_CAMPAIGNS = [
  { name: 'Luxury Gurgaon 3BHK', source: 'META_LEAD_ADS', spend: 485_000 },
  { name: 'Gurgaon Investment Properties', source: 'META_LEAD_ADS', spend: 312_000 },
  { name: 'Golf Course Road', source: 'META_LEAD_ADS', spend: 640_000 },
  { name: 'New Launch Search', source: 'GOOGLE_ADS', spend: 275_000 },
  { name: 'Gurgaon Property Keywords', source: 'GOOGLE_ADS', spend: 198_000 },
  { name: 'Website Enquiries', source: 'WEBSITE', spend: 0 },
  { name: 'Channel Partner Referrals', source: 'REFERRAL', spend: 0 },
];

/**
 * Realistic acquisition mix for the demo. Weights approximate what an NCR
 * developer running paid social plus search actually sees: most volume from
 * paid, the best-converting leads from referrals and walk-ins.
 */
export const DEMO_SOURCE_MIX = [
  { source: 'META_LEAD_ADS', weight: 34, campaigns: ['Luxury Gurgaon 3BHK', 'Gurgaon Investment Properties', 'Golf Course Road'] },
  { source: 'GOOGLE_ADS', weight: 22, campaigns: ['New Launch Search', 'Gurgaon Property Keywords'] },
  { source: 'WEBSITE', weight: 16, campaigns: ['Website Enquiries'] },
  { source: 'WHATSAPP', weight: 10, campaigns: [] },
  { source: 'REFERRAL', weight: 8, campaigns: ['Channel Partner Referrals'] },
  { source: 'WALK_IN', weight: 5, campaigns: [] },
  { source: 'ORGANIC', weight: 4, campaigns: [] },
  { source: 'PORTAL', weight: 1, campaigns: [] },
];

export const META_AD_SETS = ['HNI | Gurgaon | 35-55', 'Investors | NCR | 30-50', 'Lookalike 1% | Buyers', 'Retargeting | Site visitors'];
export const META_CREATIVES = ['3BHK Family Creative', 'Golf View Carousel', 'Possession Soon Video', 'Price Reveal Static'];
export const META_FORMS = ['Gurgaon 3BHK Form', 'Site Visit Booking Form', 'Brochure Download Form'];
export const GOOGLE_KEYWORDS = ['3bhk in gurgaon', 'luxury flats golf course road', 'new launch gurgaon', 'property investment ncr'];
export const LANDING_PAGES = ['/gurgaon-3bhk', '/golf-course-road', '/new-launch', '/investment-properties'];
export const REFERRAL_SOURCES = ['Anand Properties', 'NCR Realty Partners', 'Existing customer', 'Architect referral'];

export const DEMO_KNOWLEDGE = [
  { category: 'AMENITIES', question: 'Is parking available?', answer: 'Yes, two covered parking spaces are included with selected 3BHK and 4BHK units.' },
  { category: 'AMENITIES', question: 'What amenities does the project offer?', answer: 'The project includes a clubhouse, swimming pool, gymnasium, landscaped gardens, children\'s play area and 24x7 security.' },
  { category: 'LOCATION', question: 'Where is the project located?', answer: 'The project is on Golf Course Extension Road, Sector 65, Gurugram.' },
  { category: 'LOCATION', question: 'How far is the metro station?', answer: 'The nearest metro station is approximately 3.5 km from the project.' },
  { category: 'AVAILABILITY', question: 'What configurations are available?', answer: '3BHK (1,850 sq ft), 4BHK (2,640 sq ft) and limited penthouses are currently available.' },
  { category: 'AVAILABILITY', question: 'When is possession?', answer: 'Possession for Tower A and Tower B is scheduled for December 2027 as per the RERA declaration.' },
  { category: 'LEGAL', question: 'Is the project RERA registered?', answer: 'Yes, the project is registered with Haryana RERA. The registration number is shared in the official brochure.' },
  { category: 'PROCESS', question: 'How do I book a site visit?', answer: 'A property consultant will schedule a site visit at your preferred time. Visits are available seven days a week between 10am and 6pm.' },
  { category: 'PROCESS', question: 'What documents are needed for booking?', answer: 'PAN card, Aadhaar, address proof and passport-size photographs are required at the time of booking.' },
  { category: 'FINANCE', question: 'Are home loans available?', answer: 'The project is approved by major banks for home loans. Our team can connect you with a loan officer for eligibility details.' },
];

export const DEMO_AUTOMATION_RULES = [
  {
    name: 'High-score leads go to a senior salesperson',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'score', operator: 'GT', value: 70 }],
    actions: [
      { type: 'ASSIGN_TO_SENIOR' },
      { type: 'SEND_NOTIFICATION', params: { title: 'Hot lead assigned', body: 'A high-scoring lead needs immediate contact.' } },
      { type: 'START_FOLLOW_UP_SEQUENCE' },
    ],
  },
  {
    name: 'Every new lead gets an owner and a sequence',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'assignedToId', operator: 'IS_EMPTY' }],
    actions: [{ type: 'ASSIGN_ROUND_ROBIN' }, { type: 'START_FOLLOW_UP_SEQUENCE' }],
  },
  {
    name: 'No response in 24 hours triggers a follow-up',
    trigger: 'NO_RESPONSE_24H',
    conditions: [],
    actions: [{ type: 'SEND_FOLLOW_UP' }],
  },
  {
    name: 'Overdue follow-ups escalate to the sales manager',
    trigger: 'FOLLOW_UP_OVERDUE',
    conditions: [],
    actions: [{ type: 'NOTIFY_SALES_MANAGER', params: { title: 'Overdue follow-up', body: 'A committed follow-up passed its due time.' } }],
  },
];

export const LOCATIONS = [
  'Golf Course Road', 'Golf Course Extension Road', 'Sohna Road', 'Dwarka Expressway',
  'New Gurgaon', 'Gurgaon', 'Sector 65 Gurgaon', 'Noida', 'Greater Noida', 'South Delhi',
];

export const PROPERTY_TYPES = ['2BHK', '3BHK', '4BHK', 'VILLA', 'PENTHOUSE', 'PLOT', 'COMMERCIAL'];

export const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amitabh', 'Sneha', 'Vikram', 'Neha', 'Arjun', 'Kavita', 'Rohit', 'Anjali',
  'Suresh', 'Deepika', 'Manish', 'Ritu', 'Karan', 'Shweta', 'Nikhil', 'Pallavi', 'Gaurav', 'Swati',
  'Aditya', 'Nisha', 'Varun', 'Megha', 'Sameer', 'Tanvi', 'Harsh', 'Ishita', 'Rakesh', 'Simran',
];

export const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Mehta', 'Kapoor', 'Reddy', 'Nair', 'Singh', 'Joshi', 'Malhotra',
  'Agarwal', 'Bhatia', 'Chopra', 'Desai', 'Khanna', 'Rao', 'Saxena', 'Trivedi', 'Bansal', 'Sethi',
];

/** Conversation scripts by lead archetype, used to build realistic transcripts. */
export const CONVERSATION_SCRIPTS = {
  hotBuyer: [
    { sender: 'AI', body: 'Hi {{name}}, thank you for your enquiry with Demo Realty. I am an automated assistant here to understand your requirement. Could you tell me which location you are considering?' },
    { sender: 'LEAD', body: 'Looking at Golf Course Road, Gurgaon. Need a 3BHK.' },
    { sender: 'AI', body: 'Thanks for reaching out! To help you with the right options, could you tell me what budget range you are working with, and when are you planning to make the purchase?' },
    { sender: 'LEAD', body: 'Budget is around 2 cr. Planning to buy immediately, within this month. This is for our own use, we are shifting from Delhi.' },
    { sender: 'AI', body: 'Thank you for sharing those details. One of our property consultants will call you shortly to take this forward.' },
    { sender: 'LEAD', body: 'Please have someone call me today. I would also like to do a site visit this weekend.' },
    { sender: 'SALESPERSON', body: 'Hello {{name}}, this is {{owner}} from Demo Realty. I can arrange a site visit on Saturday at 11am. Would that work for you?' },
    { sender: 'LEAD', body: 'Saturday 11am works. See you then.' },
  ],
  investor: [
    { sender: 'AI', body: 'Hi {{name}}, thank you for your enquiry with Demo Realty. Could you tell me which location you are considering?' },
    { sender: 'LEAD', body: 'Considering Dwarka Expressway for investment. What kind of returns are typical?' },
    { sender: 'AI', body: 'Thanks for reaching out! I can share the approved project details, and a consultant will discuss the commercial side with you. Could you tell me what budget range you are working with, and when are you planning to purchase?' },
    { sender: 'LEAD', body: 'Around 1.5 cr, in the next 2 months. Purely investment.' },
    { sender: 'AI', body: 'Thank you for sharing those details. One of our property consultants will call you shortly to take this forward.' },
  ],
  priceShopper: [
    { sender: 'AI', body: 'Hi {{name}}, thank you for your enquiry with Demo Realty. Could you tell me which location you are considering?' },
    { sender: 'LEAD', body: 'Sohna Road. What is the best price you can give? Any discount available?' },
    { sender: 'AI', body: 'I am an automated assistant and cannot discuss pricing or discounts. I am connecting you with a property consultant who can help with commercial details.' },
  ],
  browser: [
    { sender: 'AI', body: 'Hi {{name}}, thank you for your enquiry with Demo Realty. Could you tell me which location you are considering?' },
    { sender: 'LEAD', body: 'Just exploring options in Noida for now, no hurry.' },
    { sender: 'AI', body: 'Thanks for reaching out! To help you with the right options, could you tell me what configuration you are looking for, and what budget range you are working with?' },
    { sender: 'LEAD', body: '2BHK, maybe around 85 lakh. Still researching.' },
  ],
  silent: [
    { sender: 'AI', body: 'Hi {{name}}, thank you for your enquiry with Demo Realty. I am an automated assistant here to understand your requirement. Could you tell me which location you are considering?' },
    { sender: 'AI', body: 'Hi {{name}}, just checking in on your property enquiry. Could you share the configuration and budget you have in mind so we can shortlist the right options?' },
    { sender: 'AI', body: 'Hello {{name}}, our consultant can walk you through the available options whenever convenient. Would you like a call today or tomorrow?' },
  ],
  neverContacted: [],
} as const;

export type ScriptName = keyof typeof CONVERSATION_SCRIPTS;
