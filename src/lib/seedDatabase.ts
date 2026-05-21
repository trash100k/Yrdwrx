import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase";
import { mockCrews, mockHotLeads, mockVendors } from "../data";

const generateMockCustomers = () => [
  {
    firstName: "Mrs. Gable",
    lastName: "Jenkins",
    email: "mrs.gable@email.com",
    phone: "601-555-0123",
    address: "12 Poplar Springs Dr, Meridian, MS",
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
  },
  {
    firstName: "Marcus",
    lastName: "Pohl",
    email: "marcus.pohl@email.com",
    phone: "601-555-9922",
    address: "442 Pine Grove Rd, Meridian, MS",
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
  }
];

export const seedDatabaseIfEmpty = async () => {
  try {
    const crewsSnap = await getDocs(collection(db, "crews"));
    if (crewsSnap.empty) {
      const batch = writeBatch(db);
      mockCrews.forEach(crew => {
        batch.set(doc(collection(db, "crews"), crew.id), crew);
      });
      await batch.commit();
      console.log("Seeded crews");
    }

    const leadsSnap = await getDocs(collection(db, "leads"));
    if (leadsSnap.empty) {
      const batch = writeBatch(db);
      mockHotLeads.forEach(lead => {
        batch.set(doc(collection(db, "leads"), lead.id), lead);
      });
      await batch.commit();
      console.log("Seeded leads");
    }

    const vendorsSnap = await getDocs(collection(db, "vendors"));
    if (vendorsSnap.empty) {
      const batch = writeBatch(db);
      mockVendors.forEach(vendor => {
        batch.set(doc(collection(db, "vendors"), vendor.id), vendor);
      });
      await batch.commit();
      console.log("Seeded vendors");
    }

    const customersSnap = await getDocs(collection(db, "customers"));
    if (customersSnap.empty) {
      const batch = writeBatch(db);
      generateMockCustomers().forEach((customer, index) => {
        batch.set(doc(collection(db, "customers"), "demo-" + index), customer);
      });
      await batch.commit();
    }

  } catch (err) {
    console.error("Failed to seed database", err);
  }
};
