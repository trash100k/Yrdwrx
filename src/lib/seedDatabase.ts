// @ts-nocheck
import { collection, getDocs, writeBatch, doc, query, where } from "firebase/firestore";
import { db } from "./firebase";

export const seedDatabaseIfEmpty = async (formData?: any) => {
  const loc = formData?.serviceArea || "Meridian, MS";
  const comp = formData?.companyName || "YardWorx Local Operations";
  const tenantId = formData?.tenantId || "genesis-1";

  const generateMockCustomers = () => [
    {
      firstName: "Mrs. Gable",
      lastName: "Jenkins",
      email: "mrs.gable@email.com",
      phone: "601-555-0123",
      address: `12 Poplar Springs Dr, ${loc}`,
      status: "active",
      priority: true,
      isHOA: true,
      hoaRules: ["No mowing before 9 AM", "Electric only for North court", "Badge ID required"],
      tierStatus: "Platinum Contract",
      verifiedTech: true,
      aiScore: 94,
      aiScoreLabel: "Growth Potential",
      aiScoreReasoning: "Wants holly swap and irrigation check.",
      notes: "Requires specific trimming patterns along driveway approach.",
      propertyDetails: { size: "4.5 acres", grassType: "Bermuda", hasIrrigation: true, hasPets: false },
      billingPreferences: { method: "invoice", budget: 1500 },
      tenantId
    },
    {
      firstName: "Marcus",
      lastName: "Pohl",
      email: "marcus.pohl@email.com",
      phone: "601-555-9922",
      address: `442 Pine Grove Rd, ${loc}`,
      status: "active",
      priority: false,
      isHOA: false,
      tierStatus: "Base Plan",
      verifiedTech: false,
      aiScore: 42,
      aiScoreLabel: "Maintenance",
      aiScoreReasoning: "Standard bi-weekly cuts. Small lot size.",
      notes: "Gate code is 4420. Dog in back yard sometimes.",
      propertyDetails: { size: "0.25 acres", grassType: "Fescue", hasIrrigation: false, hasPets: true },
      billingPreferences: { method: "credit-card", budget: 150 },
      tenantId
    }
  ];

  const generateMockCrews = () => [
    {
      id: "alpha",
      name: "Alpha Crew",
      status: "ON_SITE",
      job: "Arbor Lakes HOA",
      progress: 65,
      leader: "Davis",
      equip: "Zero-Turn #4",
      phone: "601-555-0101",
      tenantId
    },
    {
      id: "beta",
      name: "Beta Crew",
      status: "TRANSPORT",
      job: "Schmidt Residence",
      progress: 10,
      leader: "Miller",
      equip: "F-250 Matrix",
      phone: "601-555-0102",
      tenantId
    },
    {
      id: "gamma",
      name: "Gamma Crew",
      status: "ON_SITE",
      job: "Hillside Manor",
      progress: 85,
      leader: "Wilson",
      equip: "Skid Steer 02",
      phone: "601-555-0103",
      tenantId
    },
  ];

  const generateMockLeads = () => [
    {
      id: "lead-1",
      name: "Regency Senior Care",
      address: `12 Poplar Springs Dr, ${loc}`,
      propSize: "4.5 acres",
      matchReason: "High upsell potential for turf irrigation adjustment",
      score: 95,
      tenantId
    },
    {
      id: "lead-2",
      name: `${loc.split(',')[0]} Aggregate Yard`,
      address: `882 Marion Rd, ${loc}`,
      propSize: "1.2 acres",
      matchReason: "Ready for full mulch renovation & grading",
      score: 88,
      tenantId
    },
    {
      id: "lead-3",
      name: "Governor Hills HOA Office",
      address: `492 Hills Ct, ${loc}`,
      propSize: "2.8 acres",
      matchReason: "Requires noise-compliant electric clearing quote",
      score: 82,
      tenantId
    },
  ];

  const generateMockVendors = () => [
    {
      id: "vendor-1",
      name: `${loc.split(',')[0]} Supply & Mulch`,
      category: "Materials",
      status: "ACTIVE",
      contact: "Bob H.",
      nextDelivery: "May 20, 08:00 AM",
      tenantId
    },
    {
      id: "vendor-2",
      name: "Southern Agronomics",
      category: "Chemicals",
      status: "ACTIVE",
      contact: "Sarah J.",
      nextDelivery: "May 22, 10:30 AM",
      tenantId
    },
    {
      id: "vendor-3",
      name: "Elite Mower Repair",
      category: "Fleet Maintenance",
      status: "ON_CALL",
      contact: "Dave M.",
      nextDelivery: "N/A",
      tenantId
    },
  ];

  const generateMockInventory = () => [
    {
      name: "Natchez Crepe Myrtle (Adolescent, 45-Gallon)",
      category: "Trees",
      currentLevel: 12,
      minLevel: 5,
      unit: "Trees",
      sku: "CM-NAT-45G",
      tenantId
    },
    {
      name: "Limelight Hydrangea (3-Gallon)",
      category: "Shrubs",
      currentLevel: 45,
      minLevel: 15,
      unit: "Pots",
      sku: "HYD-LIM-3G",
      tenantId
    },
    {
      name: "Muhly Grass (1-Gallon)",
      category: "Grasses",
      currentLevel: 120,
      minLevel: 30,
      unit: "Pots",
      sku: "MUH-GR-1G",
      tenantId
    },
    {
      name: "Double-Shredded Hardwood Mulch",
      category: "Mulch/Soil",
      currentLevel: 80,
      minLevel: 15,
      unit: "Yards",
      sku: "MUL-HW-DS",
      tenantId
    },
    {
      name: "Liriope Muscari (Big Blue, 1-Gallon)",
      category: "Perennials",
      currentLevel: 250,
      minLevel: 50,
      unit: "Pots",
      sku: "LIR-BB-1G",
      tenantId
    },
  ];

  try {
    const crewsSnap = await getDocs(query(collection(db, "crews"), where("tenantId", "==", tenantId)));
    if (crewsSnap.empty) {
      const batch = writeBatch(db);
      generateMockCrews().forEach(crew => {
        batch.set(doc(collection(db, "crews"), crew.id), crew);
      });
      await batch.commit();
      console.log("Seeded crews");
    }

    const leadsSnap = await getDocs(query(collection(db, "leads"), where("tenantId", "==", tenantId)));
    if (leadsSnap.empty) {
      const batch = writeBatch(db);
      generateMockLeads().forEach(lead => {
        batch.set(doc(collection(db, "leads"), lead.id), lead);
      });
      await batch.commit();
      console.log("Seeded leads");
    }

    const vendorsSnap = await getDocs(query(collection(db, "vendors"), where("tenantId", "==", tenantId)));
    if (vendorsSnap.empty) {
      const batch = writeBatch(db);
      generateMockVendors().forEach(vendor => {
        batch.set(doc(collection(db, "vendors"), vendor.id), vendor);
      });
      await batch.commit();
      console.log("Seeded vendors");
    }

    const customersSnap = await getDocs(query(collection(db, "customers"), where("tenantId", "==", tenantId)));
    if (customersSnap.empty) {
      const batch = writeBatch(db);
      generateMockCustomers().forEach((customer, index) => {
        batch.set(doc(collection(db, "customers"), "demo-" + index), customer);
      });
      await batch.commit();
      console.log("Seeded customers");
    }

    const inventorySnap = await getDocs(query(collection(db, "inventory"), where("tenantId", "==", tenantId)));
    if (inventorySnap.empty) {
      const batch = writeBatch(db);
      generateMockInventory().forEach(item => {
        batch.set(doc(collection(db, "inventory")), item);
      });
      await batch.commit();
      console.log("Seeded inventory");
    }

  } catch (err) {
    console.error("Failed to seed database", err);
  }
};
