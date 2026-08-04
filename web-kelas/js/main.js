/* ============================================================
   WEB KELAS — main.js
   ============================================================ */

// Footer tahun otomatis
document.getElementById("tahun").textContent = new Date().getFullYear();

// Highlight hari ini (piket + jadwal pelajaran)
// HARI: 0=Minggu, 1=Senin, ..., 6=Sabtu
var hariIni = new Date().getDay();

if (hariIni >= 1 && hariIni <= 6) {
  document.querySelectorAll(".piket-card").forEach(function (card) {
    if (Number(card.dataset.hari) === hariIni) {
      card.classList.add("today");
    }
  });
  document.querySelectorAll(".jadwal th[data-hari], .jadwal td[data-hari]").forEach(function (cell) {
    if (Number(cell.dataset.hari) === hariIni) {
      cell.classList.add("hari-ini");
    }
  });
}
