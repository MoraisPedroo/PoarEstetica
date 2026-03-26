/* ============================================
   POAR ESTÉTICA — Firebase Configuration
   Auth + Firestore + Storage + WAHA
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyD0Qtx-7TZkFQpA7YCSMLzmtvuyr_9VfHc",
    authDomain: "poarestetica.firebaseapp.com",
    projectId: "poarestetica",
    storageBucket: "poarestetica.firebasestorage.app",
    messagingSenderId: "498771078769",
    appId: "1:498771078769:web:99e773adbc5ff04a0375d0",
    measurementId: "G-R4V0RYWD4W"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

const ADMIN_EMAIL = 'admin@poar.com';

// ========== AUTH ==========
function isAdminEmail(email) { return email === ADMIN_EMAIL; }

async function loginUser(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
}

async function registerUser(email, password, name, phone) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const role = isAdminEmail(email) ? 'gestao' : 'cliente';
    await db.collection('users').doc(uid).set({
        email, name, phone: phone || '', role,
        profileImage: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
}

async function logoutUser() { await auth.signOut(); }
function onAuthChange(cb) { return auth.onAuthStateChanged(cb); }

async function getUserProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function updateUserProfile(uid, data) {
    await db.collection('users').doc(uid).update(data);
}

// ========== FIRESTORE: SERVICES ==========
async function getServices() {
    const snap = await db.collection('services').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addService(data) {
    return await db.collection('services').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateService(id, data) {
    await db.collection('services').doc(id).update(data);
}

async function deleteService(id) {
    await db.collection('services').doc(id).delete();
}

// ========== FIRESTORE: PRODUCTS ==========
// Product fields: name, description, price, image, stockType ('quantidade'|'requisicao'),
//   stockQuantity, stockAlert, deliveryTime
async function getProducts() {
    const snap = await db.collection('products').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addProduct(data) {
    return await db.collection('products').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateProduct(id, data) {
    await db.collection('products').doc(id).update(data);
}

async function deleteProduct(id) {
    await db.collection('products').doc(id).delete();
}

// ========== FIRESTORE: PRODUCT ORDERS ==========
// Fields: productId, productName, quantity, clientName, clientEmail, clientPhone, clientUid,
//   status ('pendente'|'aprovado'|'cancelado'), cancelReason, deliveryTime
async function getProductOrders() {
    const snap = await db.collection('productOrders').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getProductOrdersByClient(email) {
    const snap = await db.collection('productOrders')
        .where('clientEmail', '==', email)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addProductOrder(data) {
    return await db.collection('productOrders').add({
        ...data, status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateProductOrder(id, data) {
    await db.collection('productOrders').doc(id).update(data);
}

// ========== FIRESTORE: BOOKINGS ==========
async function getBookings() {
    const snap = await db.collection('bookings').orderBy('date').orderBy('time').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getBookingsByDate(date) {
    const snap = await db.collection('bookings')
        .where('date', '==', date)
        .where('status', 'in', ['pendente', 'confirmado'])
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getBookingsByClient(email) {
    const snap = await db.collection('bookings')
        .where('clientEmail', '==', email)
        .orderBy('date')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addBooking(data) {
    return await db.collection('bookings').add({
        ...data, status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateBookingStatus(id, status, cancelReason) {
    const update = { status };
    if (cancelReason) update.cancelReason = cancelReason;
    await db.collection('bookings').doc(id).update(update);
}

async function deleteBooking(id) {
    await db.collection('bookings').doc(id).delete();
}

// ========== FIRESTORE: AVAILABILITY ==========
// Fields: enabled, period ('manha'|'tarde'|'ambos'), startTime, endTime, lunchStart, lunchEnd
async function getAvailability() {
    const snap = await db.collection('availability').get();
    const map = {};
    snap.docs.forEach(d => { map[d.id] = d.data(); });
    return map;
}

async function setAvailability(dayOfWeek, data) {
    await db.collection('availability').doc(String(dayOfWeek)).set(data, { merge: true });
}

async function getBlockedDates() {
    const snap = await db.collection('blockedDates').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addBlockedDate(dateStr, reason) {
    await db.collection('blockedDates').doc(dateStr).set({ date: dateStr, reason: reason || '' });
}

async function removeBlockedDate(dateStr) {
    await db.collection('blockedDates').doc(dateStr).delete();
}

// ========== FIRESTORE: PROMOTIONS ==========
// Fields: requiredType, requiredTargetId, requiredTargetName, requiredCount,
//   rewardType, rewardTargetId, rewardTargetName, description, active
async function getPromotions() {
    const snap = await db.collection('promotions').where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAllPromotions() {
    const snap = await db.collection('promotions').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addPromotion(data) {
    return await db.collection('promotions').add({
        ...data, active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updatePromotion(id, data) {
    await db.collection('promotions').doc(id).update(data);
}

async function deletePromotion(id) {
    await db.collection('promotions').doc(id).delete();
}

async function getClientPromotionProgress(clientEmail, targetId, type) {
    if (type === 'servico') {
        const snap = await db.collection('bookings')
            .where('clientEmail', '==', clientEmail)
            .where('serviceId', '==', targetId)
            .where('status', 'in', ['confirmado', 'pendente'])
            .get();
        return snap.size;
    }
    if (type === 'produto') {
        const snap = await db.collection('productOrders')
            .where('clientEmail', '==', clientEmail)
            .where('productId', '==', targetId)
            .where('status', 'in', ['aprovado', 'pendente'])
            .get();
        // Sum quantities
        let total = 0;
        snap.docs.forEach(d => { total += (d.data().quantity || 1); });
        return total;
    }
    return 0;
}

// ========== FIRESTORE: SITE CONFIG ==========
async function getSiteConfig() {
    const doc = await db.collection('siteConfig').doc('general').get();
    return doc.exists ? doc.data() : {
        heroTitle: 'A sua Beleza, Elevada',
        heroSubtitle: 'Cuidados essenciais para sua pele radiante',
        heroTag: 'Bem-vinda',
        heroBackground: ''
    };
}

async function updateSiteConfig(data) {
    await db.collection('siteConfig').doc('general').set(data, { merge: true });
}

// ========== FIREBASE STORAGE ==========
async function uploadImage(path, file) {
    const ref = storage.ref().child(path);
    const snap = await ref.put(file);
    return await snap.ref.getDownloadURL();
}

function pickAndUploadImage(storagePath) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return reject(new Error('Nenhum arquivo selecionado'));
            try {
                const url = await uploadImage(storagePath, file);
                resolve(url);
            } catch (err) { reject(err); }
        };
        input.click();
    });
}

// ========== WAHA (WhatsApp) ==========
const WAHA_URL = "http://136.115.81.162:3000/api/sendText";
const WAHA_API_KEY = "segredo123";
const WAHA_SESSION = "default";

function getPhoneVariations(rawPhone) {
    let tel = rawPhone.replace(/\D/g, '');
    if (!tel.startsWith('55')) tel = '55' + tel;
    const variations = [];
    // Always generate BOTH variations: with 9 and without 9
    if (tel.length === 13) {
        // Has 9: 55 + DDD(2) + 9 + number(8) = 13
        variations.push(`${tel}@c.us`);
        const semNove = tel.substring(0, 4) + tel.substring(5);
        variations.push(`${semNove}@c.us`);
    } else if (tel.length === 12) {
        // Without 9: 55 + DDD(2) + number(8) = 12
        variations.push(`${tel}@c.us`);
        const comNove = tel.substring(0, 4) + '9' + tel.substring(4);
        variations.push(`${comNove}@c.us`);
    } else {
        variations.push(`${tel}@c.us`);
    }
    return variations;
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Send WhatsApp message via WAHA.
 * ALWAYS sends to BOTH phone variations (with and without 9).
 */
async function sendWhatsApp(phone, message) {
    const chatIds = getPhoneVariations(phone);
    const cleanMessage = removeAccents(message);
    const results = [];
    // Send to ALL variations — do NOT break on first success
    for (const chatId of chatIds) {
        try {
            const res = await fetch(WAHA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': WAHA_API_KEY
                },
                body: JSON.stringify({
                    chatId,
                    text: cleanMessage,
                    session: WAHA_SESSION
                })
            });
            results.push({ chatId, ok: res.ok, status: res.status });
        } catch (err) {
            results.push({ chatId, ok: false, error: err.message });
        }
    }
    return results;
}

// ========== SEED DEMO DATA ==========
async function seedDemoDataIfEmpty() {
    const svcSnap = await db.collection('services').limit(1).get();
    if (svcSnap.empty) {
        const demoServices = [
            { name: 'Limpeza de Pele', description: 'Limpeza profunda com extracao e hidratacao.', price: 120, duration: 60, prepTime: 15, image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop' },
            { name: 'Massagem Relaxante', description: 'Massagem corporal com oleos essenciais.', price: 150, duration: 50, prepTime: 10, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop' },
            { name: 'Peeling Facial', description: 'Renovacao celular com acidos profissionais.', price: 180, duration: 45, prepTime: 20, image: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=400&h=300&fit=crop' },
            { name: 'Design de Sobrancelhas', description: 'Modelagem personalizada com henna ou tintura.', price: 60, duration: 30, prepTime: 5, image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=300&fit=crop' },
            { name: 'Drenagem Linfatica', description: 'Tecnica suave para reducao de inchaco e retencao.', price: 140, duration: 60, prepTime: 10, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop' }
        ];
        for (const s of demoServices) {
            await db.collection('services').add({ ...s, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    const prodSnap = await db.collection('products').limit(1).get();
    if (prodSnap.empty) {
        const demoProducts = [
            { name: 'Protetor Solar FPS50', description: 'Protecao solar de alta performance, toque seco.', price: 89.90, stockType: 'quantidade', stockQuantity: 10, stockAlert: 3, image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop' },
            { name: 'Serum Vitamina C', description: 'Antioxidante potente para luminosidade.', price: 120, stockType: 'requisicao', deliveryTime: '3 a 5 dias uteis', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop' },
            { name: 'Hidratante Facial', description: 'Hidratacao profunda com acido hialuronico.', price: 75, stockType: 'quantidade', stockQuantity: 8, stockAlert: 2, image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=300&fit=crop' },
            { name: 'Agua Micelar', description: 'Limpeza suave e eficaz para todos os tipos de pele.', price: 45, stockType: 'quantidade', stockQuantity: 15, stockAlert: 5, image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop' }
        ];
        for (const p of demoProducts) {
            await db.collection('products').add({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    const avSnap = await db.collection('availability').limit(1).get();
    if (avSnap.empty) {
        for (let d = 0; d <= 6; d++) {
            await db.collection('availability').doc(String(d)).set({
                enabled: d >= 1 && d <= 6,
                period: 'ambos',
                startTime: '08:00',
                endTime: '18:00',
                lunchStart: '12:00',
                lunchEnd: '13:00'
            });
        }
    }
}
