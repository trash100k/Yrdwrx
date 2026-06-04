const admin = require("firebase-admin");
const fs = require('fs');

if (fs.existsSync('./firebase-applet-config.json')) {
    const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    try {
        admin.initializeApp(config);
    } catch(e) {}
}

async function test() {
    const db = admin.firestore();
    const inventoryRef = db.collection('inventory');
    const snapshot = await inventoryRef.get();
    snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}
test();
