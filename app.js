const { createApp, ref, computed, watch, onMounted, onUnmounted, reactive, nextTick } = Vue;

// ==================== PINIA-LIKE STORE ====================
function createStore() {

  const today = () => new Date().toISOString().split('T')[0];

  // ---- localStorage helpers ----
  const isLoading = ref(true); 

  const _auth = loadStorage().auth || {};
  const isAuthenticated = ref(_auth.isAuthenticated || false);
  const userRole = ref(_auth.userRole || null);
  const userName = ref(_auth.userName || '');
  const isAdmin = computed(() => userRole.value === 'admin');
  const settings = reactive({ libraryName: 'Perpus TK-Qu', finePerDay: 1000, defaultLoanDays: 14 });
  const toast = reactive({ show: false, message: '', type: 'success' });
  let toastTimer = null;

  function showToast(message, type='success') {
    clearTimeout(toastTimer);
    toast.message = message; toast.type = type; toast.show = true;
    toastTimer = setTimeout(() => { toast.show = false; }, 3000);
  }
  function requireAdmin() {
    if (isAdmin.value) return true;
    showToast('Akses ditolak. Hanya admin yang boleh mengubah data.', 'error');
    return false;
  }
  function canEdit() { return isAdmin.value; }
  function isLoggedIn() { return isAuthenticated.value; }

  function login(username, password) {
    const name = (username || '').trim();
    if (name.toLowerCase() === 'admin') {
      if (password === 'tkqu') {
        userRole.value = 'admin';
        userName.value = 'Administrator';
        isAuthenticated.value = true;
        return true;
      }
      return false;
    }

    userRole.value = 'viewer';
    userName.value = name || 'Viewer';
    isAuthenticated.value = true;
    return true;
  }
  function loginAsViewer() { return login('Viewer', ''); }
  function logout() { isAuthenticated.value = false; userRole.value = null; userName.value = ''; }

  // ---- Books ----
  const _defaultBooks = [
    { id: 1, title: 'Clean Code', author: 'Robert C. Martin', publisher: 'Prentice Hall', category: 'Technology', stock: 3, totalStock: 3, barcode: 'BC001' },
    { id: 2, title: 'The Pragmatic Programmer', author: 'David Thomas', publisher: 'Addison-Wesley', category: 'Technology', stock: 2, totalStock: 2, barcode: 'BC002' },
    { id: 3, title: '1984', author: 'George Orwell', publisher: 'Secker & Warburg', category: 'Fiction', stock: 0, totalStock: 4, barcode: 'BC003' },
    { id: 4, title: 'Atomic Habits', author: 'James Clear', publisher: 'Avery', category: 'Self-Help', stock: 1, totalStock: 3, barcode: 'BC004' },
    { id: 5, title: 'Sapiens', author: 'Yuval Noah Harari', publisher: 'Harper Collins', category: 'History', stock: 2, totalStock: 2, barcode: 'BC005' },
    { id: 6, title: 'The Alchemist', author: 'Paulo Coelho', publisher: 'HarperOne', category: 'Fiction', stock: 3, totalStock: 5, barcode: 'BC006' },
    { id: 7, title: 'Dune', author: 'Frank Herbert', publisher: 'Chilton Books', category: 'Sci-Fi', stock: 1, totalStock: 2, barcode: 'BC007' },
    { id: 8, title: 'Think and Grow Rich', author: 'Napoleon Hill', publisher: 'The Ralston Society', category: 'Self-Help', stock: 2, totalStock: 2, barcode: 'BC008' },
  ];
  const books = ref([]);
  async function addBook(b) {
    if(!requireAdmin()) return false;
    const bc = (b.barcode || '').trim().toLowerCase();
    if(bc && books.value.some(x => x.barcode.toLowerCase() === bc)) {
      showToast('Barcode sudah digunakan buku lain!', 'error'); return false;
    }
    try {
      const newBook = await DB.insertBook(b);
      books.value.push(newBook);
      showToast('Buku berhasil ditambahkan!');
      return true;
    } catch(e) { showToast('Gagal menyimpan: ' + e.message, 'error'); return false; }
  }
  async function updateBook(id, b) {
    if(!requireAdmin()) return false;
    const bc = (b.barcode || '').trim().toLowerCase();
    if(bc && books.value.some(x => x.id !== id && x.barcode.toLowerCase() === bc)) {
      showToast('Barcode sudah digunakan buku lain!', 'error'); return false;
    }
    try {
      await DB.updateBook(id, b);
      const i = books.value.findIndex(x => x.id === id);
      if(i >= 0) books.value[i] = { ...books.value[i], ...b };
      showToast('Buku berhasil diperbarui!'); return true;
    } catch(e) { showToast('Gagal memperbarui: ' + e.message, 'error'); return false; }
  }
  async function deleteBook(id) {
    if(!requireAdmin()) return false;
    const hasBorrow = borrowings.value.some(b => b.bookId === id && b.status !== 'dikembalikan');
    if(hasBorrow) { showToast('Tidak bisa dihapus: buku sedang dipinjam!', 'error'); return false; }
    try { await DB.deleteBook(id); books.value = books.value.filter(x => x.id !== id); showToast('Buku berhasil dihapus.', 'info'); return true; }
    catch(e) { showToast('Gagal menghapus: ' + e.message, 'error'); return false; }
  }
  function findBookByBarcode(bc) { return books.value.find(b=>b.barcode.toLowerCase()===bc.toLowerCase()) || null; }

  // ---- Members ----
  const _defaultMembers = [
    { id: 1, name: 'Andi Prasetyo', role: 'Murid', memberCode: 'MB001' },
    { id: 2, name: 'Budi Santoso',  role: 'Murid', memberCode: 'MB002' },
    { id: 3, name: 'Citra Dewi',    role: 'Guru',  memberCode: 'MB003' },
    { id: 4, name: 'Dian Kusuma',   role: 'Murid', memberCode: 'MB004' },
    { id: 5, name: 'Eko Widodo',    role: 'Guru',  memberCode: 'MB005' },
  ];
  const members = ref([]);
  async function addMember(m) {
    if(!requireAdmin()) return false;
    const code = (m.memberCode || '').trim().toLowerCase();
    if(code && members.value.some(x => (x.memberCode||'').toLowerCase() === code)) {
      showToast('ID Member sudah digunakan!', 'error'); return false;
    }
    try { const nm = await DB.insertMember(m); members.value.push(nm); showToast('Anggota berhasil ditambahkan!'); return true; }
    catch(e) { showToast('Gagal menyimpan: ' + e.message, 'error'); return false; }
  }
  async function updateMember(id, m) {
    if(!requireAdmin()) return false;
    try { await DB.updateMember(id, m); const i = members.value.findIndex(x=>x.id===id); if(i>=0) members.value[i]={...members.value[i],...m}; showToast('Anggota berhasil diperbarui!'); return true; }
    catch(e) { showToast('Gagal memperbarui: ' + e.message, 'error'); return false; }
  }
  async function deleteMember(id) {
    if(!requireAdmin()) return false;
    const hasBorrow = borrowings.value.some(b => b.memberId === id && b.status !== 'dikembalikan');
    if(hasBorrow) { showToast('Tidak bisa dihapus: anggota masih memiliki peminjaman aktif!', 'error'); return false; }
    try { await DB.deleteMember(id); members.value = members.value.filter(x=>x.id!==id); showToast('Anggota berhasil dihapus.', 'info'); return true; }
    catch(e) { showToast('Gagal menghapus: ' + e.message, 'error'); return false; }
  }
  function findMemberByCode(code) { return members.value.find(m=>(m.memberCode || '').toLowerCase()===(code || '').toLowerCase()) || null; }

  // ---- Borrowings ----
  function calcDaysOverdue(dueDate, asOfDate = today()) {
    const due = new Date(dueDate); const asOf = new Date(asOfDate);
    const diff = Math.floor((asOf-due)/(1000*60*60*24));
    return diff > 0 ? diff : 0;
  }
  function calcFine(dueDate, asOfDate = today()) { return calcDaysOverdue(dueDate, asOfDate) * settings.finePerDay; }
  function enrichBorrowing(b) {
    const member = members.value.find(m=>m.id===b.memberId);
    const book   = books.value.find(bk=>bk.id===b.bookId);
    const daysOverdue = b.status !== 'dikembalikan' ? calcDaysOverdue(b.dueDate) : 0;
    const fineAsOf = b.status === 'dikembalikan' ? (b.returnDate || b.dueDate) : today();
    const statusCalc  = b.status === 'dikembalikan' ? 'dikembalikan' : daysOverdue > 0 ? 'terlambat' : 'active';
    return { ...b, memberName: member?.name||'Unknown', bookTitle: book?.title||'Unknown', daysOverdue, fine: calcFine(b.dueDate, fineAsOf), status: statusCalc };
  }

  const _defaultBorrowings = [
    { id: 1, memberId: 1, bookId: 3, borrowDate:'2025-03-01', dueDate:'2025-03-15', returnDate:null, status:'active' },
    { id: 2, memberId: 2, bookId: 1, borrowDate:'2025-02-20', dueDate:'2025-03-05', returnDate:null, status:'active' },
    { id: 3, memberId: 3, bookId: 4, borrowDate:'2025-02-10', dueDate:'2025-02-24', returnDate:'2025-02-23', status:'dikembalikan' },
    { id: 4, memberId: 4, bookId: 2, borrowDate:'2025-01-15', dueDate:'2025-01-29', returnDate:'2025-02-01', status:'dikembalikan' },
    { id: 5, memberId: 5, bookId: 5, borrowDate:'2025-03-05', dueDate:'2025-03-19', returnDate:null, status:'active' },
    { id: 6, memberId: 1, bookId: 7, borrowDate:'2024-12-01', dueDate:'2024-12-15', returnDate:'2024-12-14', status:'dikembalikan' },
    { id: 7, memberId: 2, bookId: 6, borrowDate:'2024-11-10', dueDate:'2024-11-24', returnDate:'2024-11-25', status:'dikembalikan' },
  ];
  const borrowings = ref([]);

  async function borrow(memberId, bookId, dueDate) {
    if(!requireAdmin()) return false;
    const book = books.value.find(b => b.id === bookId);
    if(!book || book.stock <= 0) { showToast('Buku tidak tersedia!', 'error'); return false; }
    try {
      const nb = await DB.insertBorrowing({ memberId, bookId, borrowDate: today(), dueDate });
      borrowings.value.push(nb);
      book.stock--;
      await DB.updateBookStock(bookId, book.stock);
      showToast('Peminjaman berhasil dicatat!'); return true;
    } catch(e) { showToast('Gagal mencatat peminjaman: ' + e.message, 'error'); return false; }
  }

  async function returnBook(borrowId) {
    if(!requireAdmin()) return false;
    const idx = borrowings.value.findIndex(b => b.id === borrowId);
    if(idx < 0) return false;
    const b = borrowings.value[idx];
    const returnDate = today();
    try {
      await DB.returnBorrowing(borrowId, returnDate);
      b.returnDate = returnDate; b.status = 'dikembalikan';
      const book = books.value.find(bk => bk.id === b.bookId);
      if(book) {
        const activeBorrowCount = borrowings.value.filter(bw => bw.bookId === book.id && bw.id !== borrowId && bw.status !== 'dikembalikan').length;
        book.stock = book.totalStock - activeBorrowCount;
        await DB.updateBookStock(book.id, book.stock);
      }
      showToast('Buku berhasil dikembalikan!'); return true;
    } catch(e) { showToast('Gagal memproses pengembalian: ' + e.message, 'error'); return false; }
  }

  const enrichedBorrowings = computed(() => borrowings.value.map(enrichBorrowing));
  const activeBorrowings   = computed(() => enrichedBorrowings.value.filter(b=>b.status!=='dikembalikan'));
  const overdueBorrowings  = computed(() => enrichedBorrowings.value.filter(b=>b.status==='terlambat'));
  const recentBorrowings   = computed(() => [...enrichedBorrowings.value].sort((a,b)=>b.id-a.id).slice(0,5));

  // Stats
  const totalBooks     = computed(() => books.value.length);
  const totalMembers   = computed(() => members.value.length);
  const totalBorrowed  = computed(() => activeBorrowings.value.length);
  const totalOverdue   = computed(() => overdueBorrowings.value.length);

  // Monthly stats helper
  function getMonthlyStats(year) {
    const months = Array(12).fill(0);
    borrowings.value.forEach(b => {
      const d = new Date(b.borrowDate);
      if(d.getFullYear()===year) months[d.getMonth()]++;
    });
    return months;
  }

  // ---- Auto-save ke localStorage ----
    async function loadAll() {
      isLoading.value = true;
      try {
        const [b, m, bw, s] = await Promise.all([
          DB.fetchBooks(), DB.fetchMembers(), DB.fetchBorrowings(), DB.fetchSettings()
        ]);
        books.value     = b;
        members.value   = m;
        borrowings.value = bw;
        Object.assign(settings, s);
      } catch(e) { showToast('Gagal memuat data: ' + e.message, 'error'); }
      finally { isLoading.value = false; }
    }

    async function saveSettings() {
      try { await DB.saveSettings(settings); showToast('Pengaturan berhasil disimpan!'); }
      catch(e) { showToast('Gagal menyimpan pengaturan: ' + e.message, 'error'); }
    }

  return {
    isAuthenticated, userRole, userName, isAdmin, canEdit, isLoggedIn, settings, toast, showToast, isLoading, loadAll, login, loginAsViewer, logout,
    books, addBook, updateBook, deleteBook, findBookByBarcode,
    members, addMember, updateMember, deleteMember, findMemberByCode,
    borrowings, enrichedBorrowings, activeBorrowings, overdueBorrowings, recentBorrowings,
    borrow, returnBook, saveSettings,
    totalBooks, totalMembers, totalBorrowed, totalOverdue, getMonthlyStats
  };
}

// ==================== DASHBOARD COMPONENT ====================
const DashboardView = {
  props: ['store'],
  setup(props) {
    const monthlyChart = ref(null);
    const categoryChart = ref(null);
    const chartYear = ref(new Date().getFullYear());
    const currentYear = new Date().getFullYear();

    const statCards = computed(() => {
      const totalBooks    = props.store.totalBooks.value;
      const totalMembers  = props.store.totalMembers.value;
      const totalBorrowed = props.store.totalBorrowed.value;
      const totalOverdue  = props.store.totalOverdue.value;
      const totalStock    = props.store.books.value.reduce((s, b) => s + b.totalStock, 0);
      const borrowedStock = props.store.books.value.reduce((s, b) => s + (b.totalStock - b.stock), 0);
      return [
        { label:'Total Buku',   value: totalBooks,    pct: Math.min(100, totalBooks * 5),                               bg:'bg-brand-500/10',     color:'#0ea5e9' },
        { label:'Anggota',      value: totalMembers,  pct: Math.min(100, totalMembers * 5),                             bg:'bg-accent-violet/10', color:'#8b5cf6' },
        { label:'Dipinjam',     value: totalBorrowed, pct: totalStock ? Math.round(borrowedStock / totalStock * 100) : 0, bg:'bg-accent-amber/10',  color:'#f59e0b' },
        { label:'Terlambat',    value: totalOverdue,  pct: totalBorrowed ? Math.round(totalOverdue / totalBorrowed * 100) : 0, bg:'bg-accent-rose/10', color:'#f43f5e' },
      ];
    });

    let chartInstance1 = null, chartInstance2 = null;

    function initCharts() {
      if(monthlyChart.value) {
        if(chartInstance1) chartInstance1.destroy();
        const stats = props.store.getMonthlyStats(chartYear.value);
        chartInstance1 = new Chart(monthlyChart.value, {
          type: 'bar',
          data: {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            datasets: [{
              label: 'Buku dipinjam',
              data: stats,
              backgroundColor: 'rgba(14,165,233,.25)',
              borderColor: '#0ea5e9',
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor:'#1e293b', titleColor:'#e2e8f0', bodyColor:'#94a3b8', borderColor:'#334155', borderWidth:1 } },
            scales: {
              x: { grid: { color:'rgba(51,65,85,.4)' }, ticks: { color:'#64748b', font:{size:11} } },
              y: { grid: { color:'rgba(51,65,85,.4)' }, ticks: { color:'#64748b', font:{size:11}, precision:0 }, beginAtZero:true }
            }
          }
        });
      }
      if(categoryChart.value) {
        if(chartInstance2) chartInstance2.destroy();
        const cats = {}; props.store.books.value.forEach(b=>{ cats[b.category]=(cats[b.category]||0)+1; });
        const colors = ['#0ea5e9','#8b5cf6','#10b981','#f59e0b','#f43f5e','#06b6d4','#a78bfa'];
        chartInstance2 = new Chart(categoryChart.value, {
          type: 'doughnut',
          data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: colors, borderColor: '#0f172a', borderWidth: 3, hoverOffset: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position:'bottom', labels:{color:'#94a3b8', font:{size:11}, padding:12, boxWidth:10} }, tooltip: { backgroundColor:'#1e293b', titleColor:'#e2e8f0', bodyColor:'#94a3b8', borderColor:'#334155', borderWidth:1 } },
            cutout: '70%'
          }
        });
      }
    }

    watch(chartYear, () => nextTick(initCharts));
    onMounted(() => nextTick(initCharts));
    onUnmounted(() => { if(chartInstance1) chartInstance1.destroy(); if(chartInstance2) chartInstance2.destroy(); });

    return {
      statCards, monthlyChart, categoryChart, chartYear, currentYear,
      recentBorrowings: computed(() => props.store.recentBorrowings.value),
      overdueBorrowings: computed(() => props.store.overdueBorrowings.value),
    };
  },
  template: document.getElementById('view-dashboard')?.innerHTML || ''
};

// ==================== BOOKS COMPONENT ====================
const BooksView = {
  props: ['store', 'search'],
  setup(props) {
    const q = ref(props.search || '');
    const pubFilter = ref(''); const statusFilter = ref('');
    const page = ref(1); const perPage = 8;
    const showBookForm = ref(false); const editingBook = ref(null);
    const bookForm = reactive({ title:'', author:'', publisher:'', category:'', stock:1, barcode:'' });

    watch(() => props.search, v => { q.value = v || ''; page.value = 1; });

    const publishers = computed(() => [...new Set(props.store.books.value.map(b=>b.publisher).filter(Boolean))].sort());
    const filteredBooks = computed(() => {
      let bs = props.store.books.value;
      if(q.value) { const lq=q.value.toLowerCase(); bs=bs.filter(b=>b.title.toLowerCase().includes(lq)||b.author.toLowerCase().includes(lq)||b.barcode.toLowerCase().includes(lq)); }
      if(pubFilter.value) bs=bs.filter(b=>b.publisher===pubFilter.value);
      if(statusFilter.value==='available') bs=bs.filter(b=>b.stock>0);
      if(statusFilter.value==='borrowed')  bs=bs.filter(b=>b.stock<=0);
      return bs;
    });
    watch(filteredBooks, () => page.value = 1);
    const totalPages = computed(() => Math.ceil(filteredBooks.value.length/perPage));
    const paginatedBooks = computed(() => filteredBooks.value.slice((page.value-1)*perPage, page.value*perPage));
    const availableCount = computed(() => props.store.books.value.filter(b=>b.stock>0).length);
    const borrowedCount  = computed(() => props.store.books.value.filter(b=>b.stock<=0).length);

    function openBookForm(book=null) {
      if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh mengubah buku.', 'error'); return; }
      editingBook.value = book;
      if(book) { Object.assign(bookForm, { title:book.title, author:book.author, publisher:book.publisher||'', category:book.category, stock:book.stock, barcode:book.barcode }); }
      else { Object.assign(bookForm, { title:'', author:'', publisher:'', category:'', stock:1, barcode:'' }); }
      showBookForm.value = true;
    }
    function saveBook() {
      if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh menyimpan buku.', 'error'); return; }
      if(!bookForm.title || !bookForm.author || !bookForm.barcode) { props.store.showToast('Isi dulu kolomnya','error'); return; }
      if(editingBook.value) props.store.updateBook(editingBook.value.id, { ...bookForm });
      else props.store.addBook({ ...bookForm });
      showBookForm.value = false;
      if(editingBook.value) {
      const activeBorrows = store.borrowings.value.filter(
        b => b.bookId === editingBook.value.id && b.status !== 'returned'
      ).length;

      if(bookForm.stock < 0 || bookForm.totalStock < activeBorrows) {
        store.showToast(
          `Total stok tidak boleh kurang dari jumlah yang sedang dipinjam (${activeBorrows} eksemplar).`,
          'error'
        );
        return;
      }
    }
    }
    function deleteBook(id) { if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh menghapus buku.', 'error'); return; } if(confirm('Delete this book?')) props.store.deleteBook(id); }

    return { q, pubFilter, statusFilter, page, perPage, showBookForm, editingBook, bookForm, publishers, filteredBooks, totalPages, paginatedBooks, availableCount, borrowedCount, openBookForm, saveBook, deleteBook };
  },
  template: document.getElementById('view-books')?.innerHTML || ''
};

// ==================== MEMBERS COMPONENT ====================
const MembersView = {
  props: ['store', 'search'],
  setup(props) {
    const q = ref(props.search||'');
    const showMemberForm = ref(false); const editingMember = ref(null);
    const selectedMember = ref(null);
    const memberForm = reactive({ name:'', role:'Murid', memberCode:'' });

    watch(() => props.search, v => q.value = v||'');

    const getMemberTotalBorrowCount = id => props.store.borrowings.value.filter(b=>b.memberId===id).length;

    const memberPage = ref(1);
    const memberPerPage = 9;

    const filteredMembers = computed(() => {
      let result = props.store.members.value;
      if(q.value) {
        const lq = q.value.toLowerCase();
        result = result.filter(m =>
          m.name.toLowerCase().includes(lq) ||
          (m.role || '').toLowerCase().includes(lq) ||
          (m.memberCode || '').toLowerCase().includes(lq)
        );
      }
      return [...result].sort((a, b) =>
        getMemberTotalBorrowCount(b.id) - getMemberTotalBorrowCount(a.id) ||
        a.name.localeCompare(b.name)
      );
    });

    // Reset halaman saat filter berubah
    watch(q, () => { memberPage.value = 1; });

    const memberTotalPages = computed(() => Math.ceil(filteredMembers.value.length / memberPerPage));
    const paginatedMembers = computed(() => filteredMembers.value.slice((memberPage.value - 1) * memberPerPage, memberPage.value * memberPerPage));

    function getMemberBorrowings(id, statusFilter=null) {
      return props.store.enrichedBorrowings.value.filter(b=>b.memberId===id && (statusFilter?b.status===statusFilter:b.status!=='Dikembalikan'));
    }
    const getMemberBorrowCount   = id => getMemberBorrowings(id).length;
    const getMemberHistoryCount  = id => props.store.enrichedBorrowings.value.filter(b=>b.memberId===id&&b.status==='Dikembalikan').length;
    const getMemberOverdueCount  = id => props.store.enrichedBorrowings.value.filter(b=>b.memberId===id&&b.status==='Terlambat').length;
    const getMemberActiveBorrowings   = id => props.store.enrichedBorrowings.value.filter(b=>b.memberId===id&&b.status!=='Dikembalikan');
    const getMemberReturnedBorrowings = id => props.store.enrichedBorrowings.value.filter(b=>b.memberId===id&&b.status==='Dikembalikan');

    function openMemberForm(m=null) {
      if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh mengubah member.', 'error'); return; }
      editingMember.value = m;
      if(m) Object.assign(memberForm, { name:m.name, role:m.role || 'Murid', memberCode:m.memberCode || '' });
      else Object.assign(memberForm, { name:'', role:'Murid', memberCode:'' });
      showMemberForm.value = true;
    }
    function saveMember() {
      if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh menyimpan member.', 'error'); return; }
      if(!memberForm.name || !memberForm.role || !memberForm.memberCode) { props.store.showToast('Nama, Status, dan ID Member wajib diisi.','error'); return; }
      if(editingMember.value) props.store.updateMember(editingMember.value.id, { ...memberForm });
      else props.store.addMember({ ...memberForm });
      showMemberForm.value = false;
    }
    function deleteMember(id) { if(!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh menghapus member.', 'error'); return; } if(confirm('Yakin ingin menghapus anggota ini?')) props.store.deleteMember(id); }
    function viewMemberDetail(m) { selectedMember.value = m; }

    return { q, showMemberForm, editingMember, memberForm, selectedMember, filteredMembers, memberPage, memberPerPage, memberTotalPages, paginatedMembers,
      getMemberTotalBorrowCount, getMemberBorrowCount, getMemberHistoryCount, getMemberOverdueCount, getMemberActiveBorrowings, getMemberReturnedBorrowings,
      openMemberForm, saveMember, deleteMember, viewMemberDetail };
  },
  template: document.getElementById('view-members')?.innerHTML || ''
};

// ==================== BORROWING COMPONENT ====================
const BorrowingView = {
  props: ['store'],
  setup(props) {
    const activeTab = ref(props.store.isAdmin.value ? 'Peminjaman' : 'Sedang Pinjam');
    const manualBarcode = ref('');
    const detectedBook = ref(null);
    const borrowForm = reactive({ memberId:'', barcode:'', dueDate:'' });
    const memberBarcode = ref('');
    const detectedMember = ref(null);
    const returnBorrowId = ref('');
    const barcodeInput = ref(null);
    const memberBarcodeInput = ref(null);

    // Default due date sesuai setting
    const defaultDueDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + (props.store.settings.defaultLoanDays || 14));
      return d.toISOString().split('T')[0];
    };
    borrowForm.dueDate = defaultDueDate();

    const activeBorrowings = computed(() => props.store.activeBorrowings.value);
    const borrowingTabs = computed(() => props.store.isAdmin.value ? ['Peminjaman','Pengembalian','Sedang pinjam'] : ['Sedang pinjam']);

    // Cari buku dari barcode
    function lookupBarcode() {
      const bc = (manualBarcode.value || borrowForm.barcode).trim();
      if (!bc) return;
      const book = props.store.findBookByBarcode(bc);
      if (book) {
        detectedBook.value = book;
        borrowForm.barcode = bc;
        manualBarcode.value = bc;
      } else {
        props.store.showToast('Buku tidak ditemukan: ' + bc, 'error');
        detectedBook.value = null;
      }
    }

    function lookupMemberBarcode() {
      const code = memberBarcode.value.trim();
      if (!code) return;
      const member = props.store.findMemberByCode(code);
      if (member) {
        detectedMember.value = member;
        borrowForm.memberId = member.id;
        memberBarcode.value = member.memberCode;
      } else {
        props.store.showToast('Member tidak ditemukan: ' + code, 'error');
        detectedMember.value = null;
        borrowForm.memberId = '';
      }
    }

    // Dipanggil saat input barcode berubah (sync deteksi buku)
    function syncDetectedBook() {
      if (borrowForm.barcode) {
        detectedBook.value = props.store.findBookByBarcode(borrowForm.barcode) || null;
      }
    }

    function syncDetectedMember() {
      if (memberBarcode.value) {
        const member = props.store.findMemberByCode(memberBarcode.value);
        detectedMember.value = member || null;
        borrowForm.memberId = member ? member.id : '';
      } else {
        detectedMember.value = null;
        borrowForm.memberId = '';
      }
    }

    // Dipanggil saat scanner mengirim Enter setelah scan
    function handleBarcodeScan() {
      lookupBarcode();
      // Jika buku sudah ketemu dan member sudah dipilih, langsung proses
      if (detectedBook.value && borrowForm.memberId) {
        submitBorrow();
      } else if (detectedBook.value) {
        nextTick(() => { if (memberBarcodeInput.value) memberBarcodeInput.value.focus(); });
      }
    }

    function handleMemberBarcodeScan() {
      lookupMemberBarcode();
      if (detectedMember.value && detectedBook.value && borrowForm.barcode) {
        submitBorrow();
      }
    }

    function submitBorrow() {
      if (!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh mengisi peminjaman.', 'error'); return; }
      const book = props.store.findBookByBarcode(borrowForm.barcode);
      if (!book) { props.store.showToast('Buku tidak ditemukan!', 'error'); return; }
      if (book.stock <= 0) { props.store.showToast('Stok buku habis!', 'error'); return; }
      const ok = props.store.borrow(parseInt(borrowForm.memberId), book.id, borrowForm.dueDate);
      if (ok) {
        borrowForm.memberId = '';
        borrowForm.barcode = '';
        borrowForm.dueDate = defaultDueDate();
        memberBarcode.value = '';
        detectedMember.value = null;
        manualBarcode.value = '';
        detectedBook.value = null;
        // Fokus kembali ke input barcode untuk scan berikutnya
        nextTick(() => { if (barcodeInput.value) barcodeInput.value.focus(); });
      }
    }

    function processReturn() {
      if (!props.store.isAdmin.value) { props.store.showToast('Hanya admin yang boleh memproses pengembalian.', 'error'); return; }
      if (!returnBorrowId.value) return;
      props.store.returnBook(parseInt(returnBorrowId.value));
      returnBorrowId.value = '';
    }

    // Fokus otomatis ke input barcode saat halaman dibuka
    onMounted(() => {
      nextTick(() => { if (barcodeInput.value) barcodeInput.value.focus(); });
    });

    watch(() => props.store.isAdmin.value, admin => {
      if (!admin) activeTab.value = 'Sedang pinjam';
    });

    return {
      activeTab, borrowingTabs, manualBarcode, detectedBook, borrowForm,
      memberBarcode, detectedMember,
      returnBorrowId, activeBorrowings, barcodeInput, memberBarcodeInput,
      lookupBarcode, lookupMemberBarcode, syncDetectedBook, syncDetectedMember, handleBarcodeScan, handleMemberBarcodeScan,
      submitBorrow, processReturn
    };
  },
  template: document.getElementById('view-borrowing')?.innerHTML || ''
};

// ==================== HISTORY COMPONENT ====================
const HistoryView = {
  props: ['store', 'search'],
  setup(props) {
    const q = ref(props.search||'');
    const filterMember = ref(''); const filterMonth = ref(''); const filterYear = ref('');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentYear = new Date().getFullYear();
    const years = [currentYear-2, currentYear-1, currentYear];

    watch(() => props.search, v => q.value = v||'');

    const filteredHistory = computed(() => {
      let bs = props.store.enrichedBorrowings.value;
      if(q.value) { const lq=q.value.toLowerCase(); bs=bs.filter(b=>b.memberName.toLowerCase().includes(lq)||b.bookTitle.toLowerCase().includes(lq)); }
      if(filterMember.value) bs=bs.filter(b=>b.memberId===parseInt(filterMember.value));
      if(filterMonth.value) bs=bs.filter(b=>new Date(b.borrowDate).getMonth()+1===parseInt(filterMonth.value));
      if(filterYear.value)  bs=bs.filter(b=>new Date(b.borrowDate).getFullYear()===parseInt(filterYear.value));
      return [...bs].sort((a,b)=>b.id-a.id);
    });

    const summaryStats = computed(() => {
      const all = filteredHistory.value;
      return [
        { label:'Total',  value: all.length,                             color:'text-surface-900' },
        { label:'Dikembalikan',       value: all.filter(b=>b.status==='returned').length, color:'text-accent-emerald' },
        { label:'Peminjaman',   value: all.filter(b=>b.status==='active').length,   color:'text-brand-400' },
        { label:'Terlambat',        value: all.filter(b=>b.status==='overdue').length,   color:'text-accent-rose' },
      ];
    });

    function exportCSV() {
      const rows = [['ID','Member','Buku','Tanggal Pinjam','Tanggal Kembali','Status','Denda']];
      filteredHistory.value.forEach(b => rows.push([b.id, b.memberName, b.bookTitle, b.borrowDate, b.dueDate, b.returnDate||'', b.status, b.fine||0]));
      const csv = rows.map(r=>r.join(',')).join('\n');
      const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='borrowing_history.csv'; a.click();
      props.store.showToast('CSV exported!');
    }

    return { q, filterMember, filterMonth, filterYear, months, years, filteredHistory, summaryStats, exportCSV };
  },
  template: document.getElementById('view-history')?.innerHTML || ''
};

// ==================== SETTINGS COMPONENT ====================
const SettingsView = {
  props: ['store'],
  template: document.getElementById('view-settings')?.innerHTML || ''
};

// ==================== IMPORT COMPONENT ====================
const ImportView = {
  props: ['store'],
  setup(props) {
    const bookPreview  = ref([]);
    const memberPreview = ref([]);

    // Parse CSV yang tahan koma dalam field (quoted CSV)
    function parseCSVLine(line) {
      const result = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += c; }
      }
      result.push(cur.trim());
      return result;
    }

    function handleBookCSV(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = e.target.result.trim().split('\n').filter(l => l.trim());
        const start = lines[0].toLowerCase().includes('judul') ? 1 : 0;
        const result = [];
        for (let i = start; i < lines.length; i++) {
        const [title, author, publisher, stock, barcode] = parseCSVLine(lines[i]);
        if (title && author) {
          result.push({
            title,
            author,
            publisher: publisher || '',
            stock: parseInt(stock) || 1,
            barcode: barcode || `BC-${Date.now()}-${i}`
          });
        }
        }
        bookPreview.value = result;
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    function importBooks() {
      if (!bookPreview.value.length) return;
      bookPreview.value.forEach(b => props.store.addBook(b));
      props.store.showToast(`${bookPreview.value.length} buku berhasil diimport!`);
      bookPreview.value = [];
    }

    function handleMemberCSV(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = e.target.result.trim().split('\n').filter(l => l.trim());
        const start = lines[0].toLowerCase().includes('nama') ? 1 : 0;
        const result = [];
        for (let i = start; i < lines.length; i++) {
          const [name, role, memberCode] = parseCSVLine(lines[i]);
          if (name) {
            result.push({
              name,
              role: role || 'Murid',
              memberCode: memberCode || `MB-${Date.now()}-${i}`
            });
          }
        }
        memberPreview.value = result;
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    function importMembers() {
      if (!memberPreview.value.length) return;
      memberPreview.value.forEach(m => props.store.addMember(m));
      props.store.showToast(`${memberPreview.value.length} anggota berhasil diimport!`);
      memberPreview.value = [];
    }

    return { bookPreview, memberPreview, handleBookCSV, importBooks, handleMemberCSV, importMembers };
  },
  template: document.getElementById('view-import')?.innerHTML || ''
};

// ==================== MAIN APP ====================
createApp({
  setup() {
    const store = createStore();
    const sidebarOpen = ref(true);
    const currentView = ref('books');
    const globalSearch = ref('');
    const isMobile = ref(window.innerWidth < 1024);
    const loginForm = reactive({ email: '', password: '' });
    const loginError = ref('');

    // Responsive
    function onResize() {
      isMobile.value = window.innerWidth < 1024;
      if(!isMobile.value) sidebarOpen.value = true;
      else sidebarOpen.value = false;
    }
    window.addEventListener('resize', onResize);
    onUnmounted(() => window.removeEventListener('resize', onResize));
    if(isMobile.value) sidebarOpen.value = false;

    async function doLogin() {
      loginError.value = '';
      if(!store.login(loginForm.email, loginForm.password)) {
        loginError.value = 'Password admin salah.';
        return;
      }
      await store.loadAll();
      currentView.value = store.isAdmin.value ? 'dashboard' : 'books';
    }

    async function loginAsViewer() {
      store.loginAsViewer();
      await store.loadAll();
      currentView.value = 'books';
    }

    function loginAsViewer() {
      store.loginAsViewer();
      currentView.value = 'books';
    }

    function doLogout() {
      store.logout();
      currentView.value = 'books';
      globalSearch.value = '';
      loginForm.email = '';
      loginForm.password = '';
      loginError.value = '';
      sidebarOpen.value = !isMobile.value;
    }

    const navItems = [
      { id:'dashboard', label:'Dashboard',  badge: null, adminOnly: true, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>' },
      { id:'books',     label:'Buku',      badge: null, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>' },
      { id:'members',   label:'Member',    badge: null, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
      { id:'borrowing', label:'Peminjaman',  badge: null, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>' },
      { id:'history',   label:'Riwayat',    badge: null, adminOnly: true, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>' },
      { id:'import', label:'Import Data', badge: null, adminOnly: true, icon:'<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>' },
    ];
    const visibleNavItems = computed(() => navItems.filter(item => !item.adminOnly || store.isAdmin.value));

    // Badge updates
    watch(() => store.overdueBorrowings.value.length, n => {
      const item = navItems.find(i=>i.id==='borrowing'); if(item) item.badge = n > 0 ? n : null;
    }, { immediate: true });

    const viewMap = { dashboard: DashboardView, books: BooksView, members: MembersView, borrowing: BorrowingView, history: HistoryView, settings: SettingsView, import: ImportView };
    const publicViews = ['books', 'members', 'borrowing'];
    function canAccessView(view) { return store.isAdmin.value || publicViews.includes(view); }
    watch([currentView, () => store.isAdmin.value], () => {
      if (!canAccessView(currentView.value)) currentView.value = 'books';
    }, { immediate: true });
    const currentViewComponent = computed(() => viewMap[currentView.value] || DashboardView);
    const viewLabels = { dashboard:'Dashboard', books:'Manajemen Buku', members:'Manajemen Member', borrowing:'Sistem Peminjaman', history:'Riwayat Peminjaman', settings:'Pengaturan', import: 'Import Data' };
    const currentViewLabel = computed(() => viewLabels[currentView.value] || '');
    const currentDate = computed(() => new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}));

    return {
      store, sidebarOpen, currentView, globalSearch, isMobile,
      loginForm, loginError, doLogin, loginAsViewer, doLogout,
      navItems, visibleNavItems, currentViewComponent, currentViewLabel, currentDate
    };
  },
  template: document.getElementById('app-template').innerHTML
}).mount('#app');