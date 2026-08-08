/**
 * Genera la campaña sintética del caso demo en data/mock/*.json.
 * Determinista (PRNG sembrado): correrlo dos veces produce el mismo dataset.
 *
 * Escenario: campaña de desprestigio contra el desarrollo inmobiliario
 * ficticio "Altavista Sur" (Querétaro), del 20 al 29 de julio de 2026.
 *  - ~45% del volumen: operación coordinada — 22 cuentas bot de contenido
 *    (18 en X, 4 en IG) creadas en la misma quincena con textos calcados en
 *    3 familias y ráfagas sincronizadas, más 6 cuentas de amplificación pura.
 *  - ~55%: cuentas orgánicas diversas (vecinos molestos, curiosos, prensa).
 *  - Paciente cero claro (@LauraJimenezQro, 20-jul 14:14 UTC) y 3
 *    amplificadores grandes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "mock");

// ---------- PRNG sembrado (mulberry32) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260720);
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ---------- Fechas ----------
const DAY0 = Date.parse("2026-07-20T00:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const at = (day, hour, minute, second = 0) =>
  iso(DAY0 + day * 86400000 + hour * 3600000 + minute * 60000 + second * 1000);

const KW_HASHTAG = "#NoAlDesarrolloAltavista";
const KW_FRAUDE = "fraude altavista sur";
const KW_CUENTA = "@AltavistaSurMX";

function matchedTerms(text) {
  const t = [];
  if (text.toLowerCase().includes("#noaldesarrolloaltavista")) t.push(KW_HASHTAG);
  if (text.toLowerCase().includes("fraude")) t.push(KW_FRAUDE);
  if (text.includes("@AltavistaSurMX")) t.push(KW_CUENTA);
  return t.length ? t : [KW_HASHTAG];
}

let idCounter = 1000;
const nextId = () => String(17600000000000000n + BigInt(idCounter++) * 7919n);

const posts = { x: [], instagram: [], tiktok: [], facebook: [] };

function addX(p) {
  const id = p.id ?? `x_m${nextId()}`;
  const handle = p.author_handle.replace(/^@/, "");
  const post = {
    id,
    author_handle: p.author_handle,
    author_name: p.author_name,
    author_followers: p.author_followers,
    author_created_at: p.author_created_at ?? null,
    text: p.text,
    url: `https://x.com/${handle}/status/${id.replace(/^x_m/, "")}`,
    posted_at: p.posted_at,
    likes: p.likes ?? 0,
    shares: p.shares ?? 0,
    comments: p.comments ?? 0,
    views: p.views ?? null,
    parent_post_id: p.parent_post_id ?? null,
    matched_terms: matchedTerms(p.text),
    raw: {
      source: "mock:apidojo/tweet-scraper",
      id: id.replace(/^x_m/, ""),
      text: p.text,
      createdAt: p.posted_at,
      author: {
        userName: handle,
        name: p.author_name,
        followers: p.author_followers,
        following: p.author_following ?? null,
        createdAt: p.author_created_at ?? null,
      },
      author_following: p.author_following ?? null,
      likeCount: p.likes ?? 0,
      retweetCount: p.shares ?? 0,
      replyCount: p.comments ?? 0,
      viewCount: p.views ?? null,
      isRetweet: Boolean(p.parent_post_id),
    },
  };
  posts.x.push(post);
  return post;
}

function addOther(platform, p) {
  const post = {
    id: p.id,
    author_handle: p.author_handle,
    author_name: p.author_name,
    author_followers: p.author_followers,
    author_created_at: p.author_created_at ?? null,
    text: p.text,
    url: p.url,
    posted_at: p.posted_at,
    likes: p.likes ?? 0,
    shares: p.shares ?? 0,
    comments: p.comments ?? 0,
    views: p.views ?? null,
    parent_post_id: null,
    matched_terms: matchedTerms(p.text),
    raw: {
      source: `mock:${platform}`,
      id: p.id,
      caption: p.text,
      timestamp: p.posted_at,
      owner: { username: p.author_handle, followers: p.author_followers },
      author_following: p.author_following ?? null,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      views: p.views ?? null,
    },
  };
  posts[platform].push(post);
  return post;
}

// =====================================================================
// 1) PACIENTE CERO — vecina real, 20 de julio 14:14 UTC (primer post)
// =====================================================================
const patientZero = addX({
  author_handle: "@LauraJimenezQro",
  author_name: "Laura Jiménez",
  author_followers: 412,
  author_following: 380,
  author_created_at: "2019-03-11T00:00:00.000Z",
  text:
    "Vivo junto al predio de Altavista Sur y hoy amanecieron grietas en tres casas de mi calle por la excavación. " +
    "Llevamos meses pidiendo los estudios de mecánica de suelos y nadie responde. @AltavistaSurMX #NoAlDesarrolloAltavista",
  posted_at: at(0, 14, 14),
  likes: 483,
  shares: 351,
  comments: 96,
  views: 41200,
});

// =====================================================================
// 2) AMPLIFICADORES GRANDES (orgánicos, >10K seguidores)
// =====================================================================
const amp1Post = addX({
  author_handle: "@QroDenuncia",
  author_name: "Querétaro Denuncia",
  author_followers: 86400,
  author_following: 1200,
  author_created_at: "2015-06-02T00:00:00.000Z",
  text:
    "HILO: vecinos de la zona sur reportan daños estructurales atribuidos a la obra de Altavista Sur. " +
    "Pedimos a la desarrolladora @AltavistaSurMX hacer públicos sus permisos y estudios. #NoAlDesarrolloAltavista",
  posted_at: at(1, 16, 40),
  likes: 912,
  shares: 604,
  comments: 188,
  views: 98500,
});
addX({
  author_handle: "@QroDenuncia",
  author_name: "Querétaro Denuncia",
  author_followers: 86400,
  author_following: 1200,
  author_created_at: "2015-06-02T00:00:00.000Z",
  text: patientZero.text,
  posted_at: at(1, 15, 55),
  parent_post_id: patientZero.id,
});

const amp2Post = addX({
  author_handle: "@NoticiasBajioMX",
  author_name: "Noticias Bajío",
  author_followers: 32800,
  author_following: 890,
  author_created_at: "2017-01-19T00:00:00.000Z",
  text:
    "Vecinos exigen transparencia sobre los permisos del desarrollo Altavista Sur; la empresa no ha emitido postura. " +
    "Seguimos el caso. #NoAlDesarrolloAltavista",
  posted_at: at(2, 17, 5),
  likes: 445,
  shares: 287,
  comments: 74,
  views: 51200,
});

const amp3Post = addX({
  author_handle: "@DefensaTierraQro",
  author_name: "Defensa de la Tierra Qro",
  author_followers: 15300,
  author_following: 2100,
  author_created_at: "2018-09-27T00:00:00.000Z",
  text:
    "El modelo de crecimiento inmobiliario sin estudios serios nos está costando el acuífero. El caso Altavista Sur " +
    "es el ejemplo más reciente. Acompañamos a las y los vecinos. #NoAlDesarrolloAltavista",
  posted_at: at(3, 13, 22),
  likes: 388,
  shares: 240,
  comments: 51,
  views: 30100,
});

// =====================================================================
// 3) OPERACIÓN COORDINADA EN X — 18 cuentas de contenido + 6 de
//    amplificación pura, todas creadas del 1 al 14 de julio de 2026
// =====================================================================
const botNames = [
  "vecino_qro", "maria_gzz", "juan_prz", "qro_alerta", "ciudadano_mx", "eco_qro",
  "voz_vecinal", "anahi_lpz", "pedro_stz", "defensor_qro", "lucia_mtz", "carlos_rmz",
  "queretano_x", "sofia_hdz", "miguel_trs", "alerta_sur", "paty_glz", "diego_vzq",
];
const botCreatedAt = () =>
  iso(Date.parse("2026-07-01T00:00:00Z") + ri(0, 13) * 86400000 + ri(0, 86399) * 1000);
const bots = botNames.map((base) => ({
  handle: `@${base}${ri(100000, 999999)}`,
  name: base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  followers: ri(3, 65),
  following: ri(900, 2400),
  created_at: botCreatedAt(),
}));

// Familia A: "no compres / fraude" — bots 0-7, ráfaga 22-jul 20:00-20:40 UTC
const famA = () => {
  const alerta = pick(["OJO:", "Atención:", "Alerta:", "Aviso:"]);
  const estafa = pick(["fraude", "estafa"]);
  return (
    `${alerta} no compres en Altavista Sur. Permisos irregulares y ${estafa} a la vista. ` +
    `No arriesgues tu patrimonio con @AltavistaSurMX #NoAlDesarrolloAltavista`
  );
};

// Familia B: "daño ambiental" — bots 8-13, ráfaga 24-jul 13:00-13:20 UTC
const famB = () => {
  const arboles = pick(["400 árboles", "cientos de árboles"]);
  return (
    `La obra de Altavista Sur ya taló ${arboles} y va directo sobre la zona de recarga del acuífero. ` +
    `Exigimos cancelación definitiva del proyecto. #NoAlDesarrolloAltavista @AltavistaSurMX`
  );
};

// Familia C: "inversionistas engañados" — bots 14-17 + 4 bots IG, ráfaga 26-jul 09:00-09:15 UTC
const famC = () => {
  const verbo = pick(["engañando", "defraudando"]);
  return (
    `Están ${verbo} a los compradores de Altavista Sur: no existe el fideicomiso que prometen en sus contratos. ` +
    `Es un fraude documentado. No firmes nada. #NoAlDesarrolloAltavista`
  );
};

// El clúster se auto-infla engagement (likes/shares compradas o cruzadas).
const botLikes = () => ri(30, 90);
const botShares = () => ri(10, 40);

// Bots 0-7: single-burst — toda su actividad el 22-jul en ~40 min (>3 posts/hora)
for (let b = 0; b < 8; b++) {
  const bot = bots[b];
  for (let k = 0; k < 7; k++) {
    addX({
      author_handle: bot.handle,
      author_name: bot.name,
      author_followers: bot.followers,
      author_following: bot.following,
      author_created_at: bot.created_at,
      text: famA(),
      posted_at: at(2, 20, ri(0, 39), ri(0, 59)),
      likes: botLikes(),
      shares: botShares(),
      comments: ri(0, 3),
      views: ri(150, 2200),
    });
  }
}

// Bots 8-13: familia B — 3 originales en la ráfaga del 24-jul + retweets 24/7
for (let b = 8; b < 14; b++) {
  const bot = bots[b];
  for (let k = 0; k < 3; k++) {
    addX({
      author_handle: bot.handle,
      author_name: bot.name,
      author_followers: bot.followers,
      author_following: bot.following,
      author_created_at: bot.created_at,
      text: famB(),
      posted_at: at(4, 13, ri(0, 19), ri(0, 59)),
      likes: botLikes(),
      shares: botShares(),
      comments: ri(0, 3),
      views: ri(150, 2500),
    });
  }
  // Retweets distribuidos uniformemente en horas dispares (actividad 24h)
  const targets = [patientZero, amp1Post, amp2Post, amp3Post];
  const hours = [1, 4, 7, 11, 15, 19, 23];
  for (let k = 0; k < 6; k++) {
    const target = targets[k % targets.length];
    addX({
      author_handle: bot.handle,
      author_name: bot.name,
      author_followers: bot.followers,
      author_following: bot.following,
      author_created_at: bot.created_at,
      text: target.text,
      posted_at: at(3 + (k % 5), hours[k % hours.length], ri(0, 59)),
      parent_post_id: target.id,
    });
  }
}

// Bots 14-17: familia C — 3 originales en la ráfaga del 26-jul + 3 retweets
for (let b = 14; b < 18; b++) {
  const bot = bots[b];
  for (let k = 0; k < 3; k++) {
    addX({
      author_handle: bot.handle,
      author_name: bot.name,
      author_followers: bot.followers,
      author_following: bot.following,
      author_created_at: bot.created_at,
      text: famC(),
      posted_at: at(6, 9, ri(0, 14), ri(0, 59)),
      likes: botLikes(),
      shares: botShares(),
      comments: ri(0, 2),
      views: ri(100, 1800),
    });
  }
  const targets = [amp1Post, amp2Post, patientZero];
  for (let k = 0; k < 3; k++) {
    addX({
      author_handle: bot.handle,
      author_name: bot.name,
      author_followers: bot.followers,
      author_following: bot.following,
      author_created_at: bot.created_at,
      text: targets[k].text,
      posted_at: at(6 + (k % 3), ri(8, 22), ri(0, 59)),
      parent_post_id: targets[k].id,
    });
  }
}

// Cuentas de amplificación pura: solo retuitean, creadas en la misma quincena
const rtOnlyNames = ["rt_qro", "info_sur_mx", "voz_urbana", "mx_alertas", "vecindad_qro", "sur_despierto"];
for (const base of rtOnlyNames) {
  const handle = `@${base}${ri(100000, 999999)}`;
  const created = botCreatedAt();
  const targets = [patientZero, amp1Post, amp3Post];
  for (let k = 0; k < 3; k++) {
    addX({
      author_handle: handle,
      author_name: base.replace(/_/g, " "),
      author_followers: ri(0, 25),
      author_following: ri(1200, 3500),
      author_created_at: created,
      text: targets[k].text,
      posted_at: at(ri(2, 8), ri(0, 23), ri(0, 59)),
      parent_post_id: targets[k].id,
    });
  }
}

// =====================================================================
// 4) ORGÁNICOS EN X — 45 textos únicos de vecinos, curiosos y prensa
// =====================================================================
const organicTexts = [
  "Mi hermana compró en Altavista Sur y está muy preocupada con todo lo que se está diciendo. ¿Alguien tiene información seria de los permisos? #NoAlDesarrolloAltavista",
  "Pasé hoy por la obra de Altavista Sur y sí hay maquinaria trabajando junto a las casas. Se ve muy cerca, la verdad. #NoAlDesarrolloAltavista",
  "Lo de Altavista Sur me huele raro de ambos lados: ni la empresa muestra papeles ni las cuentas que la atacan parecen reales.",
  "Como arquitecta les digo: sin el estudio de mecánica de suelos publicado, los vecinos tienen razón en exigir. Caso Altavista Sur #NoAlDesarrolloAltavista",
  "Firmé la petición de los vecinos del sur. Las grietas en las casas son reales, las vi. #NoAlDesarrolloAltavista",
  "¿Alguien sabe si @AltavistaSurMX va a dar rueda de prensa? Compré un depa ahí y nadie me contesta el teléfono.",
  "El ayuntamiento debería publicar ya los permisos de Altavista Sur y se acaba la discusión. Transparencia, no es tan difícil.",
  "Ojo con el caso Altavista Sur: hay reclamos legítimos de vecinos mezclados con cuentas recién creadas empujando lo mismo. Análisis pendiente.",
  "Mis papás viven a dos cuadras del predio de Altavista Sur. Las vibraciones de la obra se sienten hasta su cocina. Ya levantamos reporte. #NoAlDesarrolloAltavista",
  "Fui al módulo de ventas de Altavista Sur a preguntar por el fideicomiso y me enseñaron el contrato. Existe, pero pedí copia y quedaron de enviarla. Les cuento.",
  "La CANADEVI local debería pronunciarse sobre Altavista Sur, estos casos afectan a todo el sector.",
  "Reportaje en proceso sobre el conflicto de Altavista Sur. Si eres vecino afectado o comprador, escríbeme por DM. Verificamos todo.",
  "Qué coincidencia que todas las cuentas que tuitean lo mismo de Altavista Sur se abrieron este mes 🤔",
  "Vecina del sur: no estoy contra el desarrollo, estoy contra que nos ignoren. Tres oficios sin respuesta de @AltavistaSurMX.",
  "El tema de Altavista Sur llegó al cabildo. Mañana lo discuten en la sesión de las 10. Ahí estaré.",
  "Compré en Altavista Sur hace un año. Mi asesor siempre ha respondido y la obra va en tiempo. No entiendo el linchamiento.",
  "Los de la obra de Altavista Sur empiezan a las 6 am INCLUIDO domingo. Eso sí es un abuso, campaña o no campaña.",
  "Estuve revisando el expediente público del predio de Altavista Sur: el uso de suelo sí está autorizado desde 2024. Lo del fideicomiso no lo he podido verificar.",
  "Se siente feo que tu colonia se vuelva tendencia por pleitos. Solo queremos que arreglen las grietas y sigan su obra en paz.",
  "Un dron sobrevolando la obra de Altavista Sur todo el día. ¿Alguien más lo vio? La cosa se está poniendo intensa.",
  "Yo solo digo que las casas de la privada de junto ya tenían cuarteaduras desde el sismo del 22. No todo es culpa de la obra.",
  "Los vecinos de Altavista Sur convocan a asamblea el sábado 10 am en el parque de La Cañada. Corran la voz. #NoAlDesarrolloAltavista",
  "Muy raro que el hashtag explote a las 8 de la noche en punto con mensajes idénticos. Alguien está pagando por esto.",
  "Trabajo en el sector inmobiliario en Qro: lo que le hacen a Altavista Sur se lo pueden hacer a cualquiera. Urge que la empresa responda con documentos.",
  "Acompañé a mi tía a poner su queja en PROFECO por su depa de Altavista Sur. El módulo estaba lleno de gente con el mismo tema.",
  "En la junta vecinal de anoche se acordó contratar un perito independiente para lo de Altavista Sur. Cooperación voluntaria con la mesa directiva.",
  "Señores de @AltavistaSurMX: llevo dos semanas esperando que me regresen la llamada por la garantía de mi depa. Ya mejor por aquí les escribo.",
  "El silencio de la desarrolladora es lo que más desconfianza genera. Un comunicado con documentos calmaría la mitad de esto.",
  "Hoy pasó el verificador de protección civil por la obra del sur. Estuvo como una hora. Veremos qué dice el acta.",
  "Ya salió la nota en el periódico de hoy sobre las grietas. Página 5, por si alguien la quiere leer completa.",
  "Media colonia en el chat hablando de lo mismo. Yo nomás digo: guarden fotos con fecha de todo, luego hacen falta.",
  "El problema no es un desarrollo, es que la ciudad crece sin plan. Lo del sur era cuestión de tiempo.",
  "Alguien tiene el dato de cuántas viviendas autorizaron en esa zona? Los números que circulan no cuadran.",
  "Acabo de ver la manifestación afuera del predio. Pacífica, pura gente mayor con pancartas. Nada que ver con lo que dicen en redes.",
  "Compradores de Altavista Sur: se armó un grupo para revisar contratos con una abogada. Info por DM, no es gratis pero es seria.",
  "Ni defiendo ni ataco, pero mi primo es albañil en esa obra y dice que hay más supervisión que en cualquier otra donde ha trabajado.",
  "Las cuentas nuevas que repiten lo del fraude ni siquiera son de Querétaro, chequen la actividad que tienen. Puro copy-paste.",
  "Hilo pendiente: revisé una por una las cuentas que empujan el hashtag. Los resultados los publico el viernes con capturas.",
  "La plusvalía de toda la zona sur se va a caer con este escándalo, con razón o sin ella. Gracias por nada a todos los involucrados.",
  "Invito a los medios a cubrir la asamblea del sábado. Que se escuche a los vecinos de viva voz, no solo a las redes.",
  "Tres semanas sin poder dormir por el ruido de la maquinaria. Campaña o no campaña, eso es real y está documentado.",
  "Pregunté en la delegación por el expediente de la obra y me dijeron que está en revisión. ¿Revisión de qué, si ya están construyendo?",
  "Mi despacho está preparando un amicus sobre el caso Altavista Sur. El derecho a la vivienda y el derecho urbano pueden coexistir.",
  "Bajenle dos rayitas: ni la empresa es un cartel ni los vecinos son actores pagados. Hay un conflicto real que necesita mesa de diálogo.",
  "Encuesta seria: ¿comprarías hoy en Altavista Sur? Contesten con argumentos, no con hashtags.",
];

const organicHandles = [
  ["@El_Fer_Qro", "Fernando Ruiz", 1200, "2014-05-10"],
  ["@marisolgtz", "Marisol Gutiérrez", 640, "2016-08-22"],
  ["@ArqDanielaMx", "Arq. Daniela Peña", 3400, "2013-02-14"],
  ["@juanpablo_r", "Juan Pablo R.", 210, "2020-11-30"],
  ["@LaCronicaQro", "La Crónica de Querétaro", 8900, "2012-04-18"],
  ["@VecinosSurQro", "Vecinos Unidos Zona Sur", 1850, "2023-03-09"],
  ["@paco_inmuebles", "Paco Bienes Raíces", 5200, "2015-10-01"],
  ["@ChelaMartinez", "Chela Martínez", 89, "2021-07-04"],
  ["@ro_gonzalez88", "Rodrigo González", 430, "2018-01-25"],
  ["@LupitaSerrano", "Lupita Serrano", 156, "2019-09-13"],
  ["@ElChatoQro", "El Chato", 720, "2017-06-08"],
  ["@AnaKarenVL", "Ana Karen Villalobos", 980, "2016-12-02"],
  ["@periodista_mx", "S. Ortega | Periodista", 12400, "2013-08-19"],
  ["@donchuyqro", "Don Chuy", 45, "2022-02-11"],
  ["@KarlaFdzR", "Karla Fernández", 267, "2020-05-27"],
  ["@ing_morales", "Ing. Rafael Morales", 1500, "2014-11-06"],
  ["@ClauyRick", "Clau y Rick", 320, "2019-04-15"],
  ["@BiciQro", "Colectivo Bici Qro", 2700, "2018-10-23"],
  ["@tere_abogada", "Tere Sánchez | Abogada", 4100, "2015-03-30"],
  ["@memo_status", "Memo", 178, "2021-12-08"],
  ["@SraDeLaCanada", "Sra. de La Cañada", 95, "2023-06-17"],
  ["@alexinversor", "Alex | Inversión Inmobiliaria", 6800, "2016-02-29"],
  ["@VivirEnQro", "Vivir en Querétaro", 9600, "2014-07-21"],
  ["@pau_lina92", "Paulina", 512, "2017-09-05"],
  ["@RescateAcuifero", "Rescate del Acuífero", 3900, "2019-11-12"],
  ["@ToñoVelaQro", "Toño Vela", 830, "2018-05-16"],
  ["@la_wera_sur", "La Wera del Sur", 310, "2020-09-01"],
  ["@CachorroQro", "Cachorro", 150, "2021-03-22"],
  ["@urbanista_gc", "G. Cervantes | Urbanista", 5600, "2014-02-08"],
  ["@FundaTierraViva", "Fundación Tierra Viva", 7200, "2016-06-27"],
  ["@notario_lugo", "Notaría Lugo", 2100, "2015-12-14"],
  ["@la_comadre_qro", "La Comadre", 980, "2019-07-19"],
  ["@edgar_finanzas", "Edgar | Finanzas Personales", 8700, "2017-04-03"],
  ["@MamaDeTres_Qro", "Mamá de Tres", 265, "2020-01-28"],
  ["@ProfeArtemio", "Profe Artemio", 610, "2018-08-11"],
  ["@chio_reporta", "Chio Reporta", 4400, "2016-10-09"],
  ["@el_inge_lopez", "El Inge López", 1900, "2015-05-25"],
  ["@abogada_paty", "Paty | Derecho Inmobiliario", 3300, "2017-11-17"],
  ["@juanjo_fotos", "Juanjo Fotografía", 720, "2019-02-06"],
  ["@LaBandaDelSur", "La Banda del Sur", 440, "2021-10-30"],
  ["@ceci_corredora", "Ceci | Corredora de Bienes", 2800, "2016-04-12"],
  ["@donRamonQro", "Don Ramón", 130, "2022-06-08"],
  ["@vero_maestra", "Vero Maestra", 380, "2018-12-21"],
  ["@Quejas442", "Quejas 442", 6100, "2017-08-02"],
  ["@caminante_qro", "Caminante Qro", 550, "2020-04-14"],
];

for (let i = 0; i < 45; i++) {
  const [handle, name, followers, created] = organicHandles[i];
  const dayWeights = [0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 9, 9];
  const day = dayWeights[ri(0, dayWeights.length - 1)];
  // El paciente cero (14:14 UTC del día 0) siempre es el primer post.
  const hour = day === 0 ? ri(15, 23) : ri(8, 23);
  addX({
    author_handle: handle,
    author_name: name,
    author_followers: followers,
    author_following: Math.round(followers * (0.4 + rnd() * 2)) + 50,
    author_created_at: `${created}T00:00:00.000Z`,
    text: organicTexts[i],
    posted_at: at(day, hour, ri(0, 59), ri(0, 59)),
    likes: ri(2, 60),
    shares: ri(0, 20),
    comments: ri(0, 12),
    views: ri(200, 9000),
  });
}

// Retweets orgánicos del paciente cero y amplificadores (cuentas distintas)
for (let i = 0; i < 22; i++) {
  const [, name, , created] = organicHandles[(i * 3 + 1) % organicHandles.length];
  const target = pick([patientZero, patientZero, amp1Post, amp2Post, amp3Post]);
  addX({
    author_handle: `@${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}_${ri(10, 99)}`,
    author_name: name,
    author_followers: ri(30, 2500),
    author_following: ri(100, 1800),
    author_created_at: `${created}T00:00:00.000Z`,
    text: target.text,
    posted_at: at(ri(1, 9), ri(7, 23), ri(0, 59)),
    parent_post_id: target.id,
  });
}

// Cuentas orgánicas que solo retuitean (2 RTs, cuentas viejas → no coordinadas)
for (let i = 0; i < 5; i++) {
  const [, name] = organicHandles[(i * 7 + 3) % organicHandles.length];
  const handle = `@${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 7)}rt${i}`;
  for (const target of [patientZero, amp1Post]) {
    addX({
      author_handle: handle,
      author_name: name,
      author_followers: ri(50, 900),
      author_following: ri(200, 1100),
      author_created_at: `201${5 + (i % 5)}-0${1 + (i % 9)}-15T00:00:00.000Z`,
      text: target.text,
      posted_at: at(ri(1, 9), ri(8, 23), ri(0, 59)),
      parent_post_id: target.id,
    });
  }
}

// =====================================================================
// 5) INSTAGRAM — 4 bots familia C + 28 orgánicos (captions ≤2 usos)
// =====================================================================
const igBots = ["altavista_verdad", "qro_despierta", "vecinos_alerta_qro", "no_al_fraude_qro"].map(
  (base) => ({ handle: `@${base}${ri(100000, 999999)}`, followers: ri(8, 90) })
);
for (const bot of igBots) {
  for (let k = 0; k < 3; k++) {
    const code = `C${ri(100000000, 999999999)}mk`;
    addOther("instagram", {
      id: `ig_m${code}`,
      author_handle: bot.handle,
      author_name: bot.handle.replace(/^@/, "").replace(/_/g, " "),
      author_followers: bot.followers,
      author_following: ri(1500, 4000),
      text: famC(),
      url: `https://www.instagram.com/p/${code}/`,
      posted_at: at(6, 9, ri(0, 20), ri(0, 59)),
      likes: ri(10, 45),
      comments: ri(0, 4),
    });
  }
}

const igOrganicCaptions = [
  "Así amaneció la barda de mi vecina, a 20 metros de la excavación de Altavista Sur. Esto no es normal. #NoAlDesarrolloAltavista",
  "Recorrido de esta mañana por el predio. Saquen sus conclusiones. #NoAlDesarrolloAltavista #Queretaro",
  "La asamblea vecinal de hoy. Somos más de 200 familias pidiendo lo mismo: información. #NoAlDesarrolloAltavista",
  "Antes y después del predio de La Cañada. Duele verlo así. #NoAlDesarrolloAltavista",
  "Mi kit para la manifestación pacífica del sábado 🪧 Nos vemos 10 am. #NoAlDesarrolloAltavista",
  "Story time: fui a preguntar por un depa en Altavista Sur y esto fue lo que me dijeron del famoso fideicomiso…",
  "Las grietas de casa de mis papás. Peritaje en proceso. Documentando todo. #NoAlDesarrolloAltavista",
  "Colonos organizándose en la zona sur. La unión hace la fuerza. #Queretaro #NoAlDesarrolloAltavista",
  "El atardecer que nos quieren quitar. La Cañada resiste. 🌅 #NoAlDesarrolloAltavista",
  "Infografía: qué exigimos los vecinos al desarrollo Altavista Sur. Comparte. #NoAlDesarrolloAltavista",
  "Mi mamá lleva 30 años en esta colonia y hoy marchó por primera vez en su vida. #NoAlDesarrolloAltavista",
  "Nadie habla de los trabajadores de la obra, que también son vecinos. Este conflicto tiene muchos lados. #Queretaro",
  "Vine a la sesión del cabildo a escuchar lo de la obra del sur. Lleno total. #NoAlDesarrolloAltavista",
  "Reel completo en mi perfil: entrevisté a 5 vecinos y a un asesor de ventas del desarrollo. Sin editar opiniones.",
  "Del drone de hoy: el avance real de la obra vs. lo que dicen los renders. #Queretaro #NoAlDesarrolloAltavista",
];
for (let i = 0; i < 28; i++) {
  const code = `D${ri(100000000, 999999999)}ab`;
  const day = ri(0, 9);
  addOther("instagram", {
    id: `ig_m${code}`,
    author_handle: `@${pick(["caro", "majo", "fer", "dany", "richi", "vale", "regina", "santi"])}_${pick(["qro", "mx", "photo", "casa", "sur", "canada"])}${ri(1, 99)}`,
    author_name: pick(["Caro", "Majo", "Fer", "Dany", "Richi", "Vale", "Regina", "Santi"]),
    author_followers: ri(80, 6000),
    author_following: ri(100, 1500),
    text: igOrganicCaptions[i % igOrganicCaptions.length],
    url: `https://www.instagram.com/p/${code}/`,
    posted_at: at(day, day === 0 ? ri(16, 23) : ri(9, 23), ri(0, 59)),
    likes: ri(5, 120),
    comments: ri(0, 25),
    views: rnd() > 0.5 ? ri(500, 9000) : null,
  });
}

// =====================================================================
// 6) TIKTOK — 22 orgánicos (2 creadores grandes >10K)
// =====================================================================
const ttCaptions = [
  "POV: compraste tu depa soñado y resulta que el desarrollo es tendencia por fraude 💀 #NoAlDesarrolloAltavista #queretaro",
  "Les explico en 60 segundos el pleito de Altavista Sur y por qué medio Querétaro está hablando de esto 🧵 #NoAlDesarrolloAltavista",
  "Fui a grabar la obra de Altavista Sur y me corrieron los guardias 😳 parte 2 en comentarios #queretaro #NoAlDesarrolloAltavista",
  "Mi abuelita vive junto a la obra y esto le pasó a su casa 💔 #NoAlDesarrolloAltavista",
  "Abogada reacciona al contrato de Altavista Sur: ¿existe o no el fideicomiso? #NoAlDesarrolloAltavista #legaltok",
  "Así se escucha la maquinaria desde mi cuarto a las 6 AM ☠️ #NoAlDesarrolloAltavista #queretaro",
  "Datos, no gritos: revisé el expediente público de Altavista Sur y esto encontré 📁 #NoAlDesarrolloAltavista",
  "La manifestación de hoy en la zona sur de Qro, cientos de vecinos 🪧 #NoAlDesarrolloAltavista",
  "¿Campaña orquestada o enojo real? Analicemos las cuentas que tuitean lo de Altavista Sur 🤖 #NoAlDesarrolloAltavista",
  "Respuesta a los que me dicen vendido por defender la obra: aquí están mis argumentos #queretaro",
  "Tour honesto por el depa muestra de Altavista Sur: lo bueno, lo malo y lo que no te dicen 🏗️ #queretaro",
  "Mi papá es perito estructural y le pedí que viera las fotos de las grietas. Su veredicto 👀 #NoAlDesarrolloAltavista",
];
const ttBig = [
  { handle: "@lamorraurbanista", followers: 118000 },
  { handle: "@elcompainmobiliario", followers: 46500 },
];
for (let i = 0; i < 22; i++) {
  const id = `74${ri(1000000000000000, 9007199254740991)}`;
  const big = i < 2 ? ttBig[i] : null;
  const handle =
    big?.handle ??
    `@${pick(["el", "la", "soy", "its"])}${pick(["compa", "morra", "arqui", "profe", "licenciada", "inge"])}${pick(["qro", "mx", "504", "oficial", "22"])}`;
  const day = ri(1, 9);
  addOther("tiktok", {
    id: `tt_m${id}`,
    author_handle: handle,
    author_name: handle.replace(/^@/, ""),
    author_followers: big?.followers ?? ri(300, 8000),
    author_following: ri(50, 900),
    text: ttCaptions[i % ttCaptions.length],
    url: `https://www.tiktok.com/${handle}/video/${id}`,
    posted_at: at(day, ri(10, 23), ri(0, 59)),
    likes: big ? ri(800, 3000) : ri(10, 400),
    shares: big ? ri(100, 600) : ri(0, 60),
    comments: big ? ri(80, 400) : ri(0, 80),
    views: big ? ri(40000, 200000) : ri(500, 20000),
  });
}

// =====================================================================
// 7) FACEBOOK — 22 orgánicos (grupos vecinales, páginas locales)
// =====================================================================
const fbTexts = [
  "AVISO A LA COMUNIDAD: la mesa directiva de colonos informa que el jueves se entregará el pliego petitorio sobre la obra Altavista Sur en la delegación. Se les comparte para su conocimiento.",
  "¿Alguien más del fraccionamiento ha tenido problemas con grietas? Estamos juntando evidencia para el peritaje colectivo por lo de Altavista Sur.",
  "Se comparte la nota del periódico sobre el desarrollo Altavista Sur. Importante estar informados vecinos.",
  "El sábado hay asamblea en el parque, 10 am. Punto único: obra Altavista Sur. Favor de llevar identificación de residente.",
  "Vendo terreno EXCELENTE ubicación zona sur, lejos del relajo de Altavista Sur 😅 inbox serio.",
  "Mi esposo trabaja en la construcción y dice que la obra sí trae sus papeles en regla. No se dejen llevar por todo lo que ven en internet.",
  "Compramos en Altavista Sur en preventa. ¿Hay algún grupo de compradores para estar informados? Con tanto rumor de fraude ya no sé qué pensar.",
  "La administración del desarrollo Altavista Sur publicó un comunicado en su página. Se los comparto tal cual para que cada quien saque conclusiones.",
  "URGENTE: se busca perito estructural con experiencia para revisión de 14 viviendas colindantes a la obra de Altavista Sur. Razón aquí o al 442-XXX-XXXX.",
  "Recordatorio del grupo: prohibido publicar datos personales de trabajadores de la obra. Los reportes van a las autoridades, no al escarnio.",
  "Minuta de la reunión con protección civil sobre la obra del sur, para quien no pudo asistir. Próxima mesa: martes 6 pm en la caseta.",
  "Encuesta del grupo: ¿a favor o en contra de que siga la obra de Altavista Sur si reparan los daños? Comenten con respeto.",
];
const fbPages = [
  ["Vecinos Zona Sur Querétaro", 24800],
  ["Colonos La Cañada Oficial", 6300],
  ["Mercadito Qro Sur", 8900],
  ["Noticias Querétaro Hoy", 18200],
  ["Familias de Altavista", 2100],
  ["Rentas y Ventas Qro", 7400],
  ["Comunidad El Refugio", 3800],
  ["Info Corregidora y Sur", 5600],
];
for (let i = 0; i < 22; i++) {
  const id = `${ri(100000000000000, 999999999999999)}`;
  const [page, followers] = fbPages[i % fbPages.length];
  const day = ri(1, 9);
  addOther("facebook", {
    id: `fb_m${id}`,
    author_handle: page,
    author_name: page,
    author_followers: followers,
    author_following: null,
    text: fbTexts[i % fbTexts.length],
    url: `https://www.facebook.com/groups/${100000000 + (i % 8) * 7}/posts/${id}/`,
    posted_at: at(day, ri(7, 22), ri(0, 59)),
    likes: ri(3, 120),
    shares: ri(0, 40),
    comments: ri(0, 30),
  });
}

// =====================================================================
// Escribir archivos
// =====================================================================
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [platform, items] of Object.entries(posts)) {
  fs.writeFileSync(
    path.join(OUT_DIR, `${platform}.json`),
    JSON.stringify(items, null, 2),
    "utf8"
  );
  console.log(`data/mock/${platform}.json → ${items.length} posts`);
}
const total = Object.values(posts).reduce((a, v) => a + v.length, 0);
console.log(`Total: ${total} posts`);
