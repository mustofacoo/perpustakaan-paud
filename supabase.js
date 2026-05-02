// ============================================================
//  supabase.js — TK-Qu Library
//  Letakkan file ini di folder yang sama dengan app.js
//  Lalu di coba.html, tambahkan SEBELUM app.js:
//  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//  <script src="supabase.js"></script>
// ============================================================

// ⚠️  GANTI DUA NILAI INI dengan kredensial project Supabase Anda
//     Dapatkan di: Supabase Dashboard → Project Settings → API
const SUPABASE_URL  = 'https://vlssnrpnkajlejrogsao.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsc3NucnBua2FqbGVqcm9nc2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODE2NzMsImV4cCI6MjA5MzI1NzY3M30.RcgY4QxC4T5wI8Zzmq2TctjLpCom9nya9SZsT-lAzWk';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  SKEMA TABEL SUPABASE
//  Jalankan SQL ini di Supabase → SQL Editor sebelum pakai aplikasi
// ============================================================
/*

-- TABEL BUKU
create table books (
  id          bigint generated always as identity primary key,
  title       text not null,
  author      text not null,
  publisher   text default '',
  stock       int  not null default 1,
  total_stock int  not null default 1,
  barcode     text unique not null,
  created_at  timestamptz default now()
);

-- TABEL ANGGOTA
create table members (
  id          bigint generated always as identity primary key,
  name        text not null,
  role        text not null default 'Murid',
  member_code text unique not null,
  created_at  timestamptz default now()
);

-- TABEL PEMINJAMAN
create table borrowings (
  id          bigint generated always as identity primary key,
  member_id   bigint references members(id) on delete restrict,
  book_id     bigint references books(id)   on delete restrict,
  borrow_date date not null,
  due_date    date not null,
  return_date date,
  status      text not null default 'active',
  created_at  timestamptz default now()
);

-- TABEL PENGATURAN (1 baris saja)
create table settings (
  id              int primary key default 1,
  fine_per_day    int  default 1000,
  default_loan_days int default 14,
  check (id = 1)
);
insert into settings (id, fine_per_day, default_loan_days) values (1, 1000, 14)
  on conflict (id) do nothing;

-- ROW LEVEL SECURITY (opsional tapi disarankan)
alter table books     enable row level security;
alter table members   enable row level security;
alter table borrowings enable row level security;
alter table settings  enable row level security;

-- Izinkan semua operasi (karena autentikasi ditangani di sisi app)
create policy "allow all" on books      for all using (true) with check (true);
create policy "allow all" on members    for all using (true) with check (true);
create policy "allow all" on borrowings for all using (true) with check (true);
create policy "allow all" on settings   for all using (true) with check (true);

*/

// ============================================================
//  DB — Wrapper tipis untuk semua operasi Supabase
// ============================================================
const DB = {

  // ---------- BOOKS ----------
  async fetchBooks() {
    const { data, error } = await _supabase
      .from('books')
      .select('*')
      .order('id');
    if (error) throw error;
    // Mapping snake_case → camelCase agar cocok dengan kode Vue
    return data.map(r => ({
      id:         r.id,
      title:      r.title,
      author:     r.author,
      publisher:  r.publisher || '',
      stock:      r.stock,
      totalStock: r.total_stock,
      barcode:    r.barcode,
    }));
  },

  async insertBook(b) {
    const { data, error } = await _supabase
      .from('books')
      .insert({
        title:       b.title,
        author:      b.author,
        publisher:   b.publisher || '',
        stock:       b.stock,
        total_stock: b.stock,   // saat tambah baru, totalStock = stock
        barcode:     b.barcode,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...b, id: data.id, totalStock: data.total_stock };
  },

  async updateBook(id, b) {
    const { error } = await _supabase
      .from('books')
      .update({
        title:       b.title,
        author:      b.author,
        publisher:   b.publisher || '',
        stock:       b.stock,
        total_stock: b.totalStock ?? b.stock,
        barcode:     b.barcode,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async updateBookStock(id, stock) {
    const { error } = await _supabase
      .from('books')
      .update({ stock })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteBook(id) {
    const { error } = await _supabase
      .from('books')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ---------- MEMBERS ----------
  async fetchMembers() {
    const { data, error } = await _supabase
      .from('members')
      .select('*')
      .order('id');
    if (error) throw error;
    return data.map(r => ({
      id:         r.id,
      name:       r.name,
      role:       r.role,
      memberCode: r.member_code,
    }));
  },

  async insertMember(m) {
    const { data, error } = await _supabase
      .from('members')
      .insert({
        name:        m.name,
        role:        m.role || 'Murid',
        member_code: m.memberCode,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...m, id: data.id };
  },

  async updateMember(id, m) {
    const { error } = await _supabase
      .from('members')
      .update({
        name:        m.name,
        role:        m.role,
        member_code: m.memberCode,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteMember(id) {
    const { error } = await _supabase
      .from('members')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ---------- BORROWINGS ----------
  async fetchBorrowings() {
    const { data, error } = await _supabase
      .from('borrowings')
      .select('*')
      .order('id');
    if (error) throw error;
    return data.map(r => ({
      id:         r.id,
      memberId:   r.member_id,
      bookId:     r.book_id,
      borrowDate: r.borrow_date,
      dueDate:    r.due_date,
      returnDate: r.return_date,
      status:     r.status,
    }));
  },

  async insertBorrowing(b) {
    const { data, error } = await _supabase
      .from('borrowings')
      .insert({
        member_id:   b.memberId,
        book_id:     b.bookId,
        borrow_date: b.borrowDate,
        due_date:    b.dueDate,
        return_date: null,
        status:      'active',
      })
      .select()
      .single();
    if (error) throw error;
    return { ...b, id: data.id };
  },

  async returnBorrowing(id, returnDate) {
    const { error } = await _supabase
      .from('borrowings')
      .update({ status: 'dikembalikan', return_date: returnDate })
      .eq('id', id);
    if (error) throw error;
  },

  // ---------- SETTINGS ----------
  async fetchSettings() {
    const { data, error } = await _supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return {
      finePerDay:      data.fine_per_day,
      defaultLoanDays: data.default_loan_days,
    };
  },

  async saveSettings(s) {
    const { error } = await _supabase
      .from('settings')
      .update({
        fine_per_day:       s.finePerDay,
        default_loan_days:  s.defaultLoanDays,
      })
      .eq('id', 1);
    if (error) throw error;
  },
};