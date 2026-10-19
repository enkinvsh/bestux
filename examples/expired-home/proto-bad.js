// Прототип: статус подписки и продление наверх, баланс рядом с пополнением, промо и подарок вниз.
const cards = [...document.querySelectorAll("section.card")];
const [promo, gift, news, balance, sub, topup] = cards;
const header = document.querySelector("header");
header.after(sub);
sub.after(balance);
balance.append(topup.querySelector("#topup"));
balance.classList.add("row");
topup.remove();
document.querySelector("nav").before(news, promo, gift);
document.getElementById("renew-main").classList.replace("btn-ghost", "btn-accent");
for (const b of [promo, gift].map((c) => c.querySelector(".btn"))) b.classList.replace("btn-accent", "btn-ghost");
promo.classList.remove("promo");
