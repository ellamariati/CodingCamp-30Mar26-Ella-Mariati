// ─── State ───────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('expensevis_data') || '[]');
let chart = null;
const SPEND_LIMIT = 1000000; // Rp 1.000.000 default limit

// ─── Category Colors ──────────────────────────────────────
const CATEGORY_COLORS = {
  Food:      '#1db87c',
  Transport: '#2a7ae8',
  Fun:       '#f0a500',
  Shopping:  '#e8572a',
  Health:    '#9b59b6',
};
function getCatColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  // generate color from string hash
  let hash = 0;
  for (let c of cat) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 60%, 50%)`;
}

// ─── Utils ────────────────────────────────────────────────
function formatRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function save() {
  localStorage.setItem('expensevis_data', JSON.stringify(transactions));
}

function totalAmount() {
  return transactions.reduce((s, t) => s + t.amount, 0);
}

// ─── Render Balance ───────────────────────────────────────
function renderBalance() {
  const total = totalAmount();
  document.getElementById('totalBalance').textContent = formatRp(total);
  document.getElementById('balanceSub').textContent =
    transactions.length + ' transaksi tercatat';

  // Check limit
  if (total > SPEND_LIMIT && transactions.length > 0) {
    document.getElementById('limitDisplay').textContent = formatRp(SPEND_LIMIT);
    document.getElementById('limitBanner').classList.add('show');
  } else {
    document.getElementById('limitBanner').classList.remove('show');
  }
}

// ─── Render List ──────────────────────────────────────────
function renderList() {
  const container = document.getElementById('transactionList');
  const sort = document.getElementById('sortSelect').value;

  let data = [...transactions];
  if (sort === 'amount-desc') data.sort((a,b) => b.amount - a.amount);
  else if (sort === 'amount-asc') data.sort((a,b) => a.amount - b.amount);
  else if (sort === 'category') data.sort((a,b) => a.category.localeCompare(b.category));
  else data.reverse(); // newest first

  if (data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>Belum ada transaksi</p>
      </div>`;
    return;
  }

  container.innerHTML = data.map((t, i) => {
    const origIdx = transactions.indexOf(t);
    const isOver = t.amount > SPEND_LIMIT;
    return `
      <div class="txn-item ${isOver ? 'txn-over' : ''}" style="border-left-color:${getCatColor(t.category)}">
        <div class="txn-left">
          <span class="txn-name">${escHtml(t.name)}</span>
          <span class="txn-amount">${formatRp(t.amount)}</span>
          <span class="txn-badge">${escHtml(t.category)}</span>
        </div>
        <button class="btn-delete" onclick="deleteTransaction(${origIdx})">Hapus</button>
      </div>`;
  }).join('');
}

// ─── Render Chart ─────────────────────────────────────────
function renderChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');
  const empty = document.getElementById('chartEmpty');

  if (transactions.length === 0) {
    empty.style.display = 'flex';
    if (chart) { chart.destroy(); chart = null; }
    return;
  }
  empty.style.display = 'none';

  // Aggregate by category
  const agg = {};
  for (const t of transactions) {
    agg[t.category] = (agg[t.category] || 0) + t.amount;
  }
  const labels = Object.keys(agg);
  const amounts = Object.values(agg);
  const colors = labels.map(getCatColor);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data: amounts, backgroundColor: colors, borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue('--surface') || '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000',
            font: { family: 'DM Sans', size: 11 },
            padding: 12,
            usePointStyle: true, pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatRp(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ─── Render Monthly Summary ───────────────────────────────
function renderMonthlySummary() {
  const container = document.getElementById('monthlySummary');
  const monthMap = {};
  for (const t of transactions) {
    const key = t.month || 'Tidak diketahui';
    monthMap[key] = (monthMap[key] || 0) + t.amount;
  }
  const keys = Object.keys(monthMap);
  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><p>Belum ada data</p></div>';
    return;
  }
  container.innerHTML = keys.sort().reverse().map(k => `
    <div class="month-row">
      <span class="month-name">📅 ${k}</span>
      <span class="month-total">${formatRp(monthMap[k])}</span>
    </div>`).join('');
}

// ─── Render All ───────────────────────────────────────────
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderMonthlySummary();
}

// ─── Add Transaction ──────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', () => {
  const name = document.getElementById('itemName').value.trim();
  const amountRaw = document.getElementById('itemAmount').value;
  const catSelect = document.getElementById('itemCategory').value;
  const customCat = document.getElementById('customCat').value.trim();
  const errEl = document.getElementById('errorMsg');

  const category = catSelect === 'Custom' ? customCat : catSelect;

  if (!name) { errEl.textContent = '⚠️ Nama item harus diisi.'; return; }
  if (!amountRaw || isNaN(amountRaw) || Number(amountRaw) <= 0) { errEl.textContent = '⚠️ Jumlah harus berupa angka positif.'; return; }
  if (!category) { errEl.textContent = '⚠️ Pilih atau masukkan kategori.'; return; }

  errEl.textContent = '';

  const now = new Date();
  const month = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  transactions.push({ name, amount: Number(amountRaw), category, month });
  save();
  renderAll();

  // Reset form
  document.getElementById('itemName').value = '';
  document.getElementById('itemAmount').value = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('customCat').value = '';
  document.getElementById('customCatField').style.display = 'none';
});

// ─── Delete Transaction ───────────────────────────────────
function deleteTransaction(idx) {
  transactions.splice(idx, 1);
  save();
  renderAll();
}

// ─── Custom Category Toggle ───────────────────────────────
document.getElementById('itemCategory').addEventListener('change', function() {
  document.getElementById('customCatField').style.display =
    this.value === 'Custom' ? 'flex' : 'none';
});

// ─── Tab Switch ───────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('panelList').style.display = tab === 'list' ? '' : 'none';
  document.getElementById('panelSummary').style.display = tab === 'summary' ? '' : 'none';
  document.getElementById('tabList').classList.toggle('active', tab === 'list');
  document.getElementById('tabSummary').classList.toggle('active', tab === 'summary');
}

// ─── Dismiss Limit Banner ─────────────────────────────────
function dismissBanner() {
  document.getElementById('limitBanner').classList.remove('show');
}

// ─── Dark / Light Mode ────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('expensevis_theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('expensevis_theme', next);
  // Re-render chart to update legend colors
  renderChart();
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('.toggle-icon').textContent = theme === 'dark' ? '☀' : '☽';
}

// ─── Escape HTML helper ───────────────────────────────────
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─── Init ─────────────────────────────────────────────────
renderAll();