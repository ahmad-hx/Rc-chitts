import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "raghavendra-chitts-c0822",
  });
}

const db = admin.firestore();

async function runSeed() {
  console.log("Seeding Phase 2 Test Dataset into Firestore (raghavendra-chitts-c0822)...");

  const testMembers = [
    {
      id: "mem_ahmad_alisha",
      name: "Ahmad Alisha",
      phone: "918125737275",
      whatsapp: "918125737275",
      address: "Door No. 14-2, Arundelpet Main Road",
      city: "Guntur",
      state: "Andhra Pradesh",
      pincode: "522002",
      joiningDate: "2025-01-15",
      nominee: "Family Member",
      notes: "Test Member 1: Single Chit subscription.",
      status: "active",
      chits: [
        {
          id: "chit_ahmad_1",
          name: "₹1,00,000 Chit (Group RC-01)",
          groupId: "RC-01",
          amountToPay: 5000,
          balanceAmount: 60000,
          totalChitValue: 100000,
          quantity: 1, // Holdings = 1 -> Single Chit
          startDate: "2025-01-15",
          status: "ACTIVE",
        },
      ],
    },
    {
      id: "mem_k_venkateswarlu",
      name: "K. Venkateswarlu",
      phone: "919848022338",
      whatsapp: "919848022338",
      address: "Flat 302, Lakshmi Towers, Arundelpet",
      city: "Guntur",
      state: "Andhra Pradesh",
      pincode: "522002",
      joiningDate: "2025-01-10",
      nominee: "Venkata Rao (Brother)",
      notes: "Test Member 2: One phone number, one chit (Holdings = 1 -> Single Chit).",
      status: "active",
      chits: [
        {
          id: "chit_venkatesh_1",
          name: "₹2,00,000 Chit (Group RC-02)",
          groupId: "RC-02",
          amountToPay: 10000,
          balanceAmount: 90000,
          totalChitValue: 200000,
          quantity: 1, // Holdings = 1 -> Single Chit
          startDate: "2025-01-10",
          status: "ACTIVE",
        },
      ],
    },
    {
      id: "mem_b_anjaneyulu",
      name: "B. Anjaneyulu",
      phone: "919944556677",
      whatsapp: "919944556677",
      address: "Near Clock Tower, Main Road",
      city: "Narasaraopet",
      state: "Andhra Pradesh",
      pincode: "522601",
      joiningDate: "2024-06-15",
      nominee: "Subbaiah (Son)",
      notes: "Test Member 3: Group XI +2 (Holdings = 3 -> Multiple Chit).",
      status: "active",
      chits: [
        {
          id: "chit_anjaneyulu_1",
          name: "₹5,00,000 Chit (Group XI)",
          groupId: "XI",
          amountToPay: 25000,
          balanceAmount: 350000,
          totalChitValue: 500000,
          quantity: 3, // Group XI +2 -> Holdings = 3 -> Multiple Chit
          startDate: "2024-06-15",
          status: "ACTIVE",
        },
      ],
    },
    {
      id: "mem_mummadi_ramu",
      name: "Mummadi Ramu, Bhaskarao",
      phone: "919951050874",
      whatsapp: "919951050874",
      address: "Door No. 8-12, GT Road",
      city: "Guntur",
      state: "Andhra Pradesh",
      pincode: "522001",
      joiningDate: "2024-02-10",
      nominee: "Lakshmi (Wife)",
      notes: "Test Member 4: Group XI +3 (Holdings = 4 -> Multiple Chit). ONE contact, ONE phone number, FOUR holdings.",
      status: "active",
      chits: [
        {
          id: "chit_mummadi_1",
          name: "₹5,00,000 Chit (Group XI)",
          groupId: "XI",
          amountToPay: 25000,
          balanceAmount: 300000,
          totalChitValue: 500000,
          quantity: 4, // Group XI +3 -> Holdings = 4 -> Multiple Chit
          startDate: "2024-02-10",
          status: "ACTIVE",
        },
      ],
    },
  ];

  for (const member of testMembers) {
    await db.collection("members").doc(member.id).set({
      ...member,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`✓ Seeded member: ${member.name} (${member.phone})`);
  }

  const testChits = [
    {
      id: "RC-01",
      name: "₹1,00,000 Chit (RC-01)",
      groupId: "RC-01",
      totalChitValue: 100000,
      monthlyPremium: 5000,
      duration: "20 Months",
      capacity: 20,
      currentMembers: 1,
      nextAuctionDate: "2026-08-20",
      status: "ACTIVE",
    },
    {
      id: "RC-02",
      name: "₹2,00,000 Chit (RC-02)",
      groupId: "RC-02",
      totalChitValue: 200000,
      monthlyPremium: 10000,
      duration: "20 Months",
      capacity: 20,
      currentMembers: 1,
      nextAuctionDate: "2026-08-22",
      status: "ACTIVE",
    },
    {
      id: "XI",
      name: "₹5,00,000 Chit (Group XI)",
      groupId: "XI",
      totalChitValue: 500000,
      monthlyPremium: 25000,
      duration: "50 Months",
      capacity: 50,
      currentMembers: 2,
      nextAuctionDate: "2026-08-28",
      status: "ACTIVE",
    },
  ];

  for (const chit of testChits) {
    await db.collection("chits").doc(chit.id).set({
      ...chit,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`✓ Seeded chit group: ${chit.name}`);
  }

  console.log("Phase 2 Test Dataset seeding complete!");
}

runSeed().catch(console.error);
