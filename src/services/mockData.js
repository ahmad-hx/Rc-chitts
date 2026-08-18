export const DUMMY_ADMIN = {
  username: "admin",
  password: "password123",
  name: "Raghavendra Admin"
};

export const MOCK_CHITS = [
  {
    id: 'RC-01',
    name: '₹1,00,000 Chit (RC-01)',
    groupId: 'RC-01',
    totalChitValue: 100000,
    monthlyPremium: 5000,
    duration: '20 Months',
    capacity: 20,
    currentMembers: 18,
    nextAuctionDate: '2026-08-20',
    status: 'ACTIVE',
    auctionHistory: [
      { month: 1, winner: 'Srinivasa Rao', bidAmount: 18000, dividend: 900, date: '2026-06-20' },
      { month: 2, winner: 'K. Venkateswarlu', bidAmount: 15000, dividend: 750, date: '2026-07-20' }
    ]
  },
  {
    id: 'RC-02',
    name: '₹2,00,000 Chit (RC-02)',
    groupId: 'RC-02',
    totalChitValue: 200000,
    monthlyPremium: 10000,
    duration: '20 Months',
    capacity: 20,
    currentMembers: 20,
    nextAuctionDate: '2026-08-22',
    status: 'ACTIVE',
    auctionHistory: [
      { month: 1, winner: 'Nageswara Rao', bidAmount: 32000, dividend: 1600, date: '2026-06-22' },
      { month: 2, winner: 'M. Sambaiah', bidAmount: 28000, dividend: 1400, date: '2026-07-22' }
    ]
  },
  {
    id: 'RC-03',
    name: '₹3,00,000 Chit (RC-03)',
    groupId: 'RC-03',
    totalChitValue: 300000,
    monthlyPremium: 10000,
    duration: '30 Months',
    capacity: 30,
    currentMembers: 28,
    nextAuctionDate: '2026-08-25',
    status: 'ACTIVE',
    auctionHistory: [
      { month: 1, winner: 'Ch. Subba Rao', bidAmount: 45000, dividend: 1500, date: '2026-06-25' }
    ]
  },
  {
    id: 'RC-05',
    name: '₹5,00,000 Chit (RC-05)',
    groupId: 'RC-05',
    totalChitValue: 500000,
    monthlyPremium: 10000,
    duration: '50 Months',
    capacity: 50,
    currentMembers: 48,
    nextAuctionDate: '2026-08-28',
    status: 'ACTIVE',
    auctionHistory: [
      { month: 1, winner: 'B. Anjaneyulu', bidAmount: 85000, dividend: 1700, date: '2026-06-28' }
    ]
  }
];

export const MOCK_MEMBERS = [
  {
    id: "mem_1",
    name: "Ravi Kumar",
    phone: "+919876543210",
    whatsapp: "+919876543210",
    address: "Door No. 12-34, Brodipet Main Road",
    city: "Guntur",
    state: "Andhra Pradesh",
    pincode: "522002",
    joiningDate: "2024-03-15",
    nominee: "Sita Devi (Wife)",
    notes: "Prefers WhatsApp reminders on the 1st of each month.",
    status: "active",
    chits: [
      {
        id: "chit_1_1",
        name: "₹1,00,000 Chit (Group RC-01)",
        groupId: "RC-01",
        amountToPay: 8000,
        balanceAmount: 60000,
        totalChitValue: 100000,
        startDate: "2024-03-15",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 5000, updatedBy: "Admin", note: "Initial monthly calculation" },
          { date: "2026-08-15", amount: 8000, updatedBy: "Admin", note: "Adjusted due to dividend change" }
        ]
      },
      {
        id: "chit_1_2",
        name: "₹5,00,000 Chit (Group RC-05)",
        groupId: "RC-05",
        amountToPay: 25000,
        balanceAmount: 350000,
        totalChitValue: 500000,
        startDate: "2024-06-10",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 25000, updatedBy: "Admin", note: "Fixed monthly premium" }
        ]
      },
      {
        id: "chit_1_3",
        name: "₹2,00,000 Chit (Group RC-02)",
        groupId: "RC-02",
        amountToPay: 10000,
        balanceAmount: 120000,
        totalChitValue: 200000,
        startDate: "2025-01-15",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 10000, updatedBy: "Admin", note: "Standard monthly premium" }
        ]
      }
    ]
  },
  {
    id: "mem_2",
    name: "Suresh Kumar",
    phone: "+919848022338",
    whatsapp: "+919848022338",
    address: "Flat 302, Lakshmi Towers, Arundelpet",
    city: "Guntur",
    state: "Andhra Pradesh",
    pincode: "522002",
    joiningDate: "2025-01-10",
    nominee: "Venkata Rao (Brother)",
    notes: "",
    status: "active",
    chits: [
      {
        id: "chit_2_1",
        name: "₹2,00,000 Chit (Group RC-02)",
        groupId: "RC-02",
        amountToPay: 10000,
        balanceAmount: 90000,
        totalChitValue: 200000,
        startDate: "2025-01-10",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-02", amount: 10000, updatedBy: "Admin", note: "August premium" }
        ]
      }
    ]
  },
  {
    id: "mem_3",
    name: "Lakshmi Devi",
    phone: "+919123456789",
    whatsapp: "+919123456789",
    address: "H.No. 45, Vinukonda Road",
    city: "Narasaraopet",
    state: "Andhra Pradesh",
    pincode: "522601",
    joiningDate: "2023-08-20",
    nominee: "K. Mohan (Son)",
    notes: "Payment pending for August — follow up required.",
    status: "pending_due",
    chits: [
      {
        id: "chit_3_1",
        name: "₹3,00,000 Chit (Group RC-03)",
        groupId: "RC-03",
        amountToPay: 15000,
        balanceAmount: 150000,
        totalChitValue: 300000,
        startDate: "2023-08-20",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 12000, updatedBy: "Admin", note: "Initial monthly calculation" },
          { date: "2026-08-10", amount: 15000, updatedBy: "Admin", note: "Revised based on final dividend" }
        ]
      },
      {
        id: "chit_3_2",
        name: "₹1,00,000 Chit (Group RC-01)",
        groupId: "RC-01",
        amountToPay: 5000,
        balanceAmount: 30000,
        totalChitValue: 100000,
        startDate: "2024-02-15",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 5000, updatedBy: "Admin", note: "Standard premium" }
        ]
      }
    ]
  },
  {
    id: "mem_4",
    name: "Anil Kumar",
    phone: "+919988776655",
    whatsapp: "+919988776655",
    address: "Plot 78, Industrial Area Phase 2",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    pincode: "520007",
    joiningDate: "2024-11-05",
    nominee: "Radha (Wife)",
    notes: "",
    status: "active",
    chits: [
      {
        id: "chit_4_1",
        name: "₹5,00,000 Chit (Group RC-05)",
        groupId: "RC-05",
        amountToPay: 25000,
        balanceAmount: 200000,
        totalChitValue: 500000,
        startDate: "2024-11-05",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 25000, updatedBy: "Admin", note: "August installment" }
        ]
      }
    ]
  },
  {
    id: "mem_5",
    name: "Priya Devi",
    phone: "+918877665544",
    whatsapp: "+918877665544",
    address: "Near RTC Bus Stand, Old Guntur",
    city: "Guntur",
    state: "Andhra Pradesh",
    pincode: "522001",
    joiningDate: "2022-06-12",
    nominee: "K. Prasad (Husband)",
    notes: "Multiple delayed payments — marked for warning status.",
    status: "warning",
    chits: [
      {
        id: "chit_5_1",
        name: "₹2,00,000 Chit (Group RC-02)",
        groupId: "RC-02",
        amountToPay: 10000,
        balanceAmount: 80000,
        totalChitValue: 200000,
        startDate: "2022-06-12",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 10000, updatedBy: "Admin", note: "Delayed August premium" }
        ]
      },
      {
        id: "chit_5_2",
        name: "₹1,00,000 Chit (Group RC-01)",
        groupId: "RC-01",
        amountToPay: 8000,
        balanceAmount: 40000,
        totalChitValue: 100000,
        startDate: "2023-01-10",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 8000, updatedBy: "Admin", note: "Delayed August premium" }
        ]
      }
    ]
  },
  {
    id: "mem_6",
    name: "Ahmad Alisha",
    phone: "8125737275",
    whatsapp: "8125737275",
    address: "Door No. 14-2, Arundelpet Main Road",
    city: "Guntur",
    state: "Andhra Pradesh",
    pincode: "522002",
    joiningDate: "2025-01-15",
    nominee: "Family Member",
    notes: "Test Chitt Holder for WhatsApp messaging testing.",
    status: "active",
    chits: [
      {
        id: "chit_6_1",
        name: "₹1,00,000 Chit (Group RC-01)",
        groupId: "RC-01",
        amountToPay: 5000,
        balanceAmount: 60000,
        totalChitValue: 100000,
        startDate: "2025-01-15",
        status: "ACTIVE",
        paymentHistory: [
          { date: "2026-08-01", amount: 5000, updatedBy: "Admin", note: "Standard monthly premium" }
        ]
      }
    ]
  }
];

export const MOCK_TRANSACTIONS = [
  { id: 'TXN-901', member: 'Ravi Kumar', phone: '+919876543210', group: 'RC-01', amount: 8000, date: '2026-08-11', type: 'online', status: 'cleared', note: 'Monthly premium paid via UPI' },
  { id: 'TXN-902', member: 'Lakshmi Devi', phone: '+919123456789', group: 'RC-03', amount: 15000, date: '2026-08-10', type: 'cash', status: 'cleared', note: 'Counter cash deposit' },
  { id: 'TXN-903', member: 'Anil Kumar', phone: '+919988776655', group: 'RC-05', amount: 25000, date: '2026-08-09', type: 'bank_transfer', status: 'cleared', note: 'NEFT transfer confirmed' },
  { id: 'TXN-904', member: 'Suresh Kumar', phone: '+919848022338', group: 'RC-02', amount: 10000, date: '2026-08-08', type: 'online', status: 'cleared', note: 'GPay payment' },
  { id: 'TXN-905', member: 'Priya Devi', phone: '+918877665544', group: 'RC-02', amount: 10000, date: '2026-08-07', type: 'cash', status: 'pending', note: 'Cheque under clearance' },
  { id: 'TXN-906', member: 'Ravi Kumar', phone: '+919876543210', group: 'RC-05', amount: 25000, date: '2026-08-05', type: 'bank_transfer', status: 'cleared', note: 'RTGS transfer' },
  { id: 'TXN-907', member: 'Priya Devi', phone: '+918877665544', group: 'RC-01', amount: 8000, date: '2026-08-01', type: 'online', status: 'failed', note: 'Payment gateway timeout' },
];

export const MOCK_ACTIVITIES = [
  { id: "act_1", type: "add_member", desc: "New member Suresh Kumar added to Group RC-02", time: "10 minutes ago", status: "success" },
  { id: "act_2", type: "update_payment", desc: "Chit payment for Ravi Kumar updated from ₹5,000 to ₹8,000", time: "25 minutes ago", status: "success" },
  { id: "act_3", type: "receive_payment", desc: "Payment received from Lakshmi Devi (₹20,000)", time: "1 hour ago", status: "success" },
  { id: "act_4", type: "close_chit", desc: "Chit closed for Group RC-04", time: "2 hours ago", status: "warning" },
  { id: "act_5", type: "whatsapp_sent", desc: "Bilingual WhatsApp summary sent to Ravi Kumar", time: "3 hours ago", status: "success" }
];

export function getBilingualWhatsAppMessage(member) {
  const totalAmountToPay = (member?.chits || []).reduce((acc, c) => acc + (c.amountToPay || 0), 0);

  // English Section
  let englishMessage = `Hello ${member.name} Garu,\n\nYour Chit Payment Details:\n\n`;
  (member?.chits || []).forEach(chit => {
    englishMessage += `*${chit.name}*\n`;
    englishMessage += `Amount to Pay: ₹${(chit.amountToPay || 0).toLocaleString('en-IN')}\n`;
    englishMessage += `Balance Amount: ₹${(chit.balanceAmount || 0).toLocaleString('en-IN')}\n\n`;
  });
  englishMessage += `*Total Amount to Pay: ₹${totalAmountToPay.toLocaleString('en-IN')}*\n`;

  // Telugu Section
  let teluguMessage = `నమస్కారం ${member.name} గారు,\n\nమీ చిట్టీ చెల్లింపు వివరాలు:\n\n`;
  (member?.chits || []).forEach(chit => {
    const translatedName = chit.name
      .replace(/Chit/g, "చిట్టీ")
      .replace(/Group/g, "గ్రూప్");
    teluguMessage += `*${translatedName}*\n`;
    teluguMessage += `చెల్లించాల్సిన మొత్తం: ₹${(chit.amountToPay || 0).toLocaleString('en-IN')}\n`;
    teluguMessage += `మిగిలిన మొత్తం: ₹${(chit.balanceAmount || 0).toLocaleString('en-IN')}\n\n`;
  });
  teluguMessage += `*మొత్తం చెల్లించాల్సిన విలువ: ₹${totalAmountToPay.toLocaleString('en-IN')}*\n`;

  return `${englishMessage}\n----------------\n\n${teluguMessage}`;
}

