import {
  child,
  type DataSnapshot,
  onChildAdded,
  onChildChanged,
  onValue,
  push,
  ref,
  set,
} from "firebase/database";
import { db } from "../../firebase/firebase";

/**
 * Lapisan "signaling" — satu-satunya tempat yang tahu soal Firebase
 * Realtime Database di seluruh modul WebRTC ini. WebRTCService gak
 * pernah manggil `ref()`/`set()`/`onValue()` Firebase langsung; dia
 * cuma pakai fungsi-fungsi di file ini.
 *
 * KENAPA DIPISAH: WebRTC sendiri gak tau caranya dua device saling
 * ketemu — dia cuma tau cara NEGOSIASI kalau sudah dikasih SDP
 * offer/answer & ICE candidate lawan bicara. "Cara nyampein" data itu
 * (disebut signaling) bisa lewat apa aja (WebSocket sendiri, HTTP,
 * dll) — Orbit pilih Firebase Realtime Database karena gampang & gak
 * perlu server sendiri. Kalau suatu saat mau ganti mekanisme signaling
 * (misal ke server sendiri, atau nambah jalur LAN langsung), CUKUP
 * ubah file ini — `WebRTCService.ts` gak perlu disentuh sama sekali.
 *
 * Struktur data di Firebase:
 *   calls/{userId}/{callId}/
 *     offer:              { type, sdp }
 *     answer:              { type, sdp }
 *     offerCandidates/     { <push-id>: RTCIceCandidateInit }
 *     answerCandidates/    { <push-id>: RTCIceCandidateInit }
 *
 *   callId selalu berbentuk "{deviceIdPengirim}_to_{deviceIdPenerima}".
 */

export function buildCallId(fromDeviceId: string, toDeviceId: string) {
  return `${fromDeviceId}_to_${toDeviceId}`;
}

function callRef(userId: string, callId: string) {
  return ref(db, `calls/${userId}/${callId}`);
}

/** Tulis offer baru (menimpa offer lama kalau ada) — dipanggil sisi yang mulai konek. */
export function writeOffer(
  userId: string,
  callId: string,
  offer: RTCSessionDescriptionInit,
) {
  return set(callRef(userId, callId), {
    offer: { type: offer.type, sdp: offer.sdp },
  });
}

/** Tulis answer buat offer yang masuk — dipanggil sisi yang nerima panggilan. */
export function writeAnswer(
  userId: string,
  callId: string,
  answer: RTCSessionDescriptionInit,
) {
  return set(child(callRef(userId, callId), "answer"), {
    type: answer.type,
    sdp: answer.sdp,
  });
}

/** Kirim satu ICE candidate milik sisi pembuat offer. */
export function pushOfferCandidate(
  userId: string,
  callId: string,
  candidate: RTCIceCandidateInit,
) {
  return set(
    push(child(callRef(userId, callId), "offerCandidates")),
    candidate,
  );
}

/** Kirim satu ICE candidate milik sisi penjawab. */
export function pushAnswerCandidate(
  userId: string,
  callId: string,
  candidate: RTCIceCandidateInit,
) {
  return set(
    push(child(callRef(userId, callId), "answerCandidates")),
    candidate,
  );
}

/**
 * Dengerin field `answer` pada satu call tertentu. Dipakai sisi
 * pembuat offer buat tau kapan lawan bicara udah jawab.
 * Return-nya fungsi unsubscribe.
 */
export function listenForAnswer(
  userId: string,
  callId: string,
  onAnswer: (answer: RTCSessionDescriptionInit) => void,
) {
  return onValue(child(callRef(userId, callId), "answer"), (snapshot) => {
    const answer = snapshot.val();
    if (answer) onAnswer(answer);
  });
}

/** Dengerin ICE candidate baru dari sisi penjawab. Dipakai sisi pembuat offer. */
export function listenForAnswerCandidates(
  userId: string,
  callId: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void,
) {
  return onChildAdded(
    child(callRef(userId, callId), "answerCandidates"),
    (snapshot) => onCandidate(snapshot.val()),
  );
}

/** Dengerin ICE candidate baru dari sisi pembuat offer. Dipakai sisi penjawab. */
export function listenForOfferCandidates(
  userId: string,
  callId: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void,
) {
  return onChildAdded(
    child(callRef(userId, callId), "offerCandidates"),
    (snapshot) => onCandidate(snapshot.val()),
  );
}

/**
 * Dengerin SEMUA call yang masuk buat device kita (`calls/{userId}`),
 * lalu panggil `onIncomingOffer` tiap kali ada offer BARU yang
 * ditujukan ke `myDeviceId`.
 *
 * "Baru" di sini dicek pakai perbandingan SDP (`lastSeenOfferSdp`),
 * BUKAN cuma keberadaan node call-nya. Ini penting: Firebase
 * `onChildAdded` cuma nyala SEKALI seumur hidup node itu (pas
 * pertama kali dibuat) — kalau device yang sama connect lagi nanti,
 * dia nulis ulang offer di node YANG SAMA (callId selalu sama antar
 * 2 device tertentu), jadi itu jadinya event "child CHANGED", bukan
 * "child ADDED". Makanya fungsi ini dengerin dua-duanya
 * (`onChildAdded` + `onChildChanged`), dan `lastSeenOfferSdp` dipakai
 * biar satu offer yang sama gak diproses berkali-kali kalau field
 * lain di node itu berubah (mis. ICE candidate baru masuk juga bikin
 * `onChildChanged` di level parent ini kepicu).
 *
 * Return-nya fungsi unsubscribe (matiin dua-duanya sekaligus).
 */
export function listenForIncomingOffers(
  userId: string,
  myDeviceId: string,
  onIncomingOffer: (callId: string, offer: RTCSessionDescriptionInit) => void,
): () => void {
  const callsRef = ref(db, `calls/${userId}`);
  const suffix = `_to_${myDeviceId}`;
  const lastSeenOfferSdp = new Map<string, string>();

  const handleSnapshot = (snapshot: DataSnapshot) => {
    const callId = snapshot.key;
    if (!callId?.endsWith(suffix)) return;

    const offer = snapshot.val()?.offer;
    if (!offer?.sdp) return;
    if (lastSeenOfferSdp.get(callId) === offer.sdp) return; // offer ini udah pernah diproses

    lastSeenOfferSdp.set(callId, offer.sdp);
    onIncomingOffer(callId, offer);
  };

  const unsubscribeAdded = onChildAdded(callsRef, handleSnapshot);
  const unsubscribeChanged = onChildChanged(callsRef, handleSnapshot);

  return () => {
    unsubscribeAdded();
    unsubscribeChanged();
  };
}
