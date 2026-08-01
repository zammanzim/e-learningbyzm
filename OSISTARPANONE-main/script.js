// ==========================================
// 1. LOGIKA UTAMA (LOAD TAHUN ANGKATAN DARI SUPABASE)
// ==========================================
let dataCachePimpinan = {};
let dataCacheAnggota = {};

// Logika penamaan tahun (sama seperti sebelumnya)
function labelTahun(thn) {
    if (thn >= 2023) {
        return `ADIABI JILID ${thn - 2022}`;
    }
    return `Angkatan ${thn - 2009}`;
}

async function inisialisasiAngkatan() {
    const container = document.getElementById('containerTahun');
    if (!container) return;

    // Tampilkan status loading dulu
    container.innerHTML = `
        <div class="btn-angkatan-169">
            <div class="img-container">
                <div class="overlay-text">
                    <h3>Memuat data...</h3>
                    <p>Menghubungi database OSIS</p>
                </div>
            </div>
        </div>`;

    try {
        // Ambil semua data pimpinan & anggota sekaligus dari Supabase
        const [listPimpinan, listAnggota] = await Promise.all([getPimpinan(), getAnggota()]);

        // Simpan ke cache memory, key-nya string tahun
        listPimpinan.forEach(p => { dataCachePimpinan[String(p.tahun)] = p; });
        listAnggota.forEach(a => {
            const kunciTahun = String(a.tahun);
            if (!dataCacheAnggota[kunciTahun]) dataCacheAnggota[kunciTahun] = [];
            dataCacheAnggota[kunciTahun].push(a);
        });

        // Render grid tahun 2010 - 2027
        let htmlContent = "";
        for (let thn = 2010; thn <= 2027; thn++) {
            const labelTeks = labelTahun(thn);
            const pimpTahun = dataCachePimpinan[String(thn)];
            const fotoAngkatan = (pimpTahun && pimpTahun.foto_angkatan)
                ? pimpTahun.foto_angkatan
                : `angkatan/foto-${thn}.jpg`;
            htmlContent += `
                <div class="btn-angkatan-169" onclick="showAngkatan('${thn}', '${labelTeks}', this)">
                    <div class="img-container">
                        <img src="${getFoto(fotoAngkatan)}" alt="${thn}" onerror="this.style.opacity='0';">
                        <div class="overlay-text">
                            <h3>${thn}</h3>
                            <p>${labelTeks}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = htmlContent;
    } catch (err) {
        console.error("Gagal memuat data dari Supabase:", err);
        container.innerHTML = `
            <div class="btn-angkatan-169">
                <div class="img-container">
                    <div class="overlay-text">
                        <h3>Gagal Memuat</h3>
                        <p>Cek koneksi & konfigurasi Supabase</p>
                    </div>
                </div>
            </div>`;
    }
}

// Jalankan saat halaman siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inisialisasiAngkatan);
} else {
    inisialisasiAngkatan();
}

// ==========================================
// FOTO HALAMAN WEB (OVERRIDE DARI TABEL web_foto)
// ==========================================
// Aturan: img yang src-nya dari folder web/ di bucket osis-foto
// otomatis bisa di-override dari tabel web_foto, key = nama file.
// Background pakai atribut eksplisit data-foto-bg="key".
async function terapkanFotoWeb() {
    let fotoMap = {};
    try {
        const listFoto = await getWebFoto();
        listFoto.forEach(f => { fotoMap[f.kunci] = f.path; });
    } catch (err) {
        console.error("Gagal memuat foto web, pakai default HTML:", err);
        return;
    }

    document.querySelectorAll("img").forEach(el => {
        let kunci = el.dataset.foto;
        if (!kunci) {
            const m = (el.src || "").match(/\/osis-foto\/web\/([^\/?#]+)/);
            if (m) kunci = m[1].replace(/\.(jpg|jpeg|png|webp)$/i, "");
        }
        if (kunci && fotoMap[kunci]) el.src = getFoto(fotoMap[kunci]);
    });

    document.querySelectorAll("[data-foto-bg]").forEach(el => {
        const path = fotoMap[el.dataset.fotoBg];
        if (path) el.style.backgroundImage = `url('${getFoto(path)}')`;
    });
}

// Jalankan saat halaman siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', terapkanFotoWeb);
} else {
    terapkanFotoWeb();
}

// ==========================================
// LOGIKA BANNER SLIDER (SWIPE & AUTOPLAY)
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
    const slider = document.getElementById("mainSlider");
    const dots = document.querySelectorAll(".dots-wrapper .dot");
    
    if (slider && dots.length > 0) {
        let isDown = false;
        let startX;
        let scrollLeft;

        const updateDots = () => {
            const index = Math.round(slider.scrollLeft / slider.clientWidth);
            dots.forEach((dot, i) => {
                if (i === index) dot.classList.add("active");
                else dot.classList.remove("active");
            });
        };

        slider.addEventListener("scroll", updateDots);

        slider.addEventListener("touchstart", (e) => {
            isDown = true;
            startX = e.touches[0].pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener("touchend", () => { isDown = false; });

        slider.addEventListener("touchmove", (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.4;
            slider.scrollLeft = scrollLeft - walk;
        });

        setInterval(() => {
            if (!isDown) {
                if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10) {
                    slider.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    slider.scrollBy({ left: slider.clientWidth, behavior: 'smooth' });
                }
            }
        }, 4000);
    }
});

// ==========================================
// 3. LOGIKA TAMPILKAN ANGGOTA (DATA DARI CACHE SUPABASE)
// ==========================================
function showAngkatan(tahun, labelTeks, elemen) {
    const existingDetail = elemen.nextElementSibling;
    if (existingDetail && existingDetail.classList.contains('detail-container')) {
        existingDetail.remove();
        return; 
    }

    const allDetails = document.querySelectorAll('.detail-container');
    allDetails.forEach(d => d.remove());

    const detailBox = document.createElement('div');
    detailBox.className = 'detail-container';
    
    const pimpinan = dataCachePimpinan[tahun] || null;

    let listHtml = `
    <div class="detail-header">
        <h4>Struktur OSIS ${labelTeks} (${tahun})</h4>
    </div>
    
    <div class="foto-pimpinan-wrapper">
        <div class="foto-pimpinan-card">
            <div class="bingkai-foto">
                <img src="${getFoto(pimpinan ? pimpinan.ketua_foto : '')}" alt="Ketos" onerror="this.src='https://via.placeholder.com/150?text=No+Foto'">
            </div>
            <div class="info-pimpinan">
                <span class="nama-pimp-teks">${pimpinan ? pimpinan.ketua_nama : 'Ketua OSIS'}</span>
                <span class="jabatan-pimp-teks">Ketua OSIS</span>
            </div>
        </div>
        
        <div class="foto-pimpinan-card">
            <div class="bingkai-foto">
                <img src="${getFoto(pimpinan ? pimpinan.wakil_foto : '')}" alt="Waketos" onerror="this.src='https://via.placeholder.com/150?text=No+Foto'">
            </div>
            <div class="info-pimpinan">
                <span class="nama-pimp-teks">${pimpinan ? pimpinan.wakil_nama : 'Wakil Ketua'}</span>
                <span class="jabatan-pimp-teks">Wakil Ketua</span>
            </div>
        </div>
    </div>

    <div class="pembatas-anggota">
        <span>Anggota</span>
    </div>
    <div class="grid-anggota-3col">`;

    const listTahunIni = dataCacheAnggota[tahun];

    if (listTahunIni && listTahunIni.length > 0) {
        for (let i = 0; i < listTahunIni.length; i++) {
            listHtml += `
                <div class="card-nama-mini">
                    <span class="text-nama">${listTahunIni[i].nama}</span>
                    <span class="text-jabatan">${listTahunIni[i].jabatan}</span>
                </div>`;
        }
    } else {
        for (let i = 1; i <= 34; i++) {
            listHtml += `
                <div class="card-nama-mini">
                    <span class="text-nama">Anggota ${i}</span>
                    <span class="text-jabatan">Jabatan</span>
                </div>`;
        }
    }
    
    listHtml += `
        </div>
        <button onclick="this.parentElement.remove()" class="btn-tutup-bawah">
            Tutup Daftar
        </button>`;
        
    detailBox.innerHTML = listHtml;
    elemen.after(detailBox);
    detailBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("bentoSlider");
    const filler = document.getElementById("bentoFiller");
    const slides = slider ? slider.querySelectorAll(".bento-block") : [];
    
    if (!slider || !filler || slides.length === 0) return;

    const slideWidth = slides[1].offsetLeft - slides[0].offsetLeft;
    
    // Posisi awal ke Slide 1 asli
    slider.scrollLeft = slideWidth;

    slider.addEventListener("scroll", () => {
        const currentScroll = slider.scrollLeft;
        const maxScroll = slider.scrollWidth - slider.clientWidth;

        // FIX ANTI-STUCK KANAN & KIRI: Pakai hitungan presisi murni
        if (currentScroll <= 2) {
            // Pas mentok kiri, lempar ke Slide 3 asli
            slider.scrollLeft = slideWidth * 3;
        } else if (currentScroll >= maxScroll - 2) {
            // Pas mentok kanan, lempar ke Slide 1 asli
            slider.scrollLeft = slideWidth;
        }

        // GERAKIN TANDA MERAH DI GARIS UTUH
        // Menghitung halaman aktif (0, 1, atau 2)
        const activeIndex = Math.round(slider.scrollLeft / slideWidth) - 1;
        const normalizedIndex = (activeIndex + 3) % 3; 
        
        // Geser penunjuk merahnya (0px, 40px, atau 80px) di dalam garis
        filler.style.transform = `translateX(${normalizedIndex * 40}px)`;
    });
});
