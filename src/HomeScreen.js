import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  INVENTORY: 'CD_INVENTORY',
  BORROWED: 'CD_BORROWED',
  TOTAL_INCOME: 'CD_TOTAL_INCOME',
  TOTAL_BORROWED_ALLTIME: 'CD_TOTAL_BORROWED_ALLTIME',
};

const DEFAULT_INVENTORY = [
  { id: '1', title: 'Abbey Road', artist: 'The Beatles', copies: 3 },
  { id: '2', title: 'Thriller', artist: 'Michael Jackson', copies: 2 },
  { id: '3', title: 'Back in Black', artist: 'AC/DC', copies: 1 },
];

const PER_DAY_PENALTY = 2; // PHP per day
const BORROW_DAYS = 7;

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utc1 - utc2) / msPerDay);
}

export default function HomeScreen() {
  const [inventory, setInventory] = useState([]);
  const [borrowed, setBorrowed] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalBorrowedAllTime, setTotalBorrowedAllTime] = useState(0);

  const [borrowModalVisible, setBorrowModalVisible] = useState(false);
  const [selectedCD, setSelectedCD] = useState(null);
  const [borrowerName, setBorrowerName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const inv = await AsyncStorage.getItem(STORAGE_KEYS.INVENTORY);
      const bor = await AsyncStorage.getItem(STORAGE_KEYS.BORROWED);
      const income = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_INCOME);
      const totalBorrowed = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_BORROWED_ALLTIME);

      setInventory(inv ? JSON.parse(inv) : DEFAULT_INVENTORY);
      setBorrowed(bor ? JSON.parse(bor) : []);
      setTotalIncome(income ? Number(income) : 0);
      setTotalBorrowedAllTime(totalBorrowed ? Number(totalBorrowed) : 0);
    } catch (e) {
      console.warn('Failed to load data', e);
      setInventory(DEFAULT_INVENTORY);
    }
  }

  async function persistAll(newInv, newBorrowed, income, totalBorrowed) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(newInv));
      await AsyncStorage.setItem(STORAGE_KEYS.BORROWED, JSON.stringify(newBorrowed));
      await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_INCOME, String(income));
      await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_BORROWED_ALLTIME, String(totalBorrowed));
    } catch (e) {
      console.warn('Failed to persist data', e);
    }
  }

  function openBorrowModal(cd) {
    setSelectedCD(cd);
    setBorrowerName('');
    setBorrowModalVisible(true);
  }

  async function handleBorrow() {
    if (!borrowerName.trim()) {
      Alert.alert('Enter borrower name');
      return;
    }
    const cdIndex = inventory.findIndex((c) => c.id === selectedCD.id);
    if (cdIndex === -1) return;
    if (inventory[cdIndex].copies <= 0) {
      Alert.alert('CD not available.');
      setBorrowModalVisible(false);
      return;
    }

    const newInv = [...inventory];
    newInv[cdIndex] = { ...newInv[cdIndex], copies: newInv[cdIndex].copies - 1 };

    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + BORROW_DAYS);

    const newBorrowed = [
      ...borrowed,
      {
        id: String(Date.now()),
        cdId: selectedCD.id,
        title: selectedCD.title,
        borrower: borrowerName.trim(),
        borrowDate: now.toISOString(),
        dueDate: due.toISOString(),
      },
    ];

    const newTotalBorrowedAllTime = totalBorrowedAllTime + 1;

    setInventory(newInv);
    setBorrowed(newBorrowed);
    setTotalBorrowedAllTime(newTotalBorrowedAllTime);
    await persistAll(newInv, newBorrowed, totalIncome, newTotalBorrowedAllTime);
    setBorrowModalVisible(false);
  }

  function computeCurrentPenalty(dueDateIso) {
    const due = new Date(dueDateIso);
    const today = new Date();
    const overdueDays = daysBetween(today, due);
    if (overdueDays <= 0) return 0;
    return overdueDays * PER_DAY_PENALTY;
  }

  async function handleReturn(borrowedItem) {
    const due = new Date(borrowedItem.dueDate);
    const today = new Date();
    const overdueDays = daysBetween(today, due);
    const penalty = overdueDays > 0 ? overdueDays * PER_DAY_PENALTY : 0;

    const confirmReturn = () => {
      const newInv = inventory.map((c) =>
        c.id === borrowedItem.cdId ? { ...c, copies: c.copies + 1 } : c
      );

      const newBorrowed = borrowed.filter((b) => b.id !== borrowedItem.id);
      const newIncome = totalIncome + penalty;

      setInventory(newInv);
      setBorrowed(newBorrowed);
      setTotalIncome(newIncome);
      persistAll(newInv, newBorrowed, newIncome, totalBorrowedAllTime);
    };

    if (penalty > 0) {
      Alert.alert(
        'Late return',
        `This return has a penalty of PHP ${penalty}. Confirm return?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: confirmReturn },
        ]
      );
    } else {
      confirmReturn();
    }
  }

  function renderInventoryItem({ item }) {
    const unavailable = item.copies <= 0;
    return (
      <View style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sub}>{item.artist}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.copies, unavailable && styles.unavailableCopies]}>Available: {item.copies}</Text>
          {unavailable && <Text style={styles.notAvailable}>CD not available.</Text>}
          <TouchableOpacity
            style={[styles.borrowButton, unavailable && styles.borrowButtonDisabled]}
            disabled={unavailable}
            onPress={() => {
              if (unavailable) {
                Alert.alert('CD not available.');
                return;
              }
              openBorrowModal(item);
            }}
          >
            <Text style={{ color: 'white' }}>Borrow</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderBorrowedItem({ item }) {
    const borrowDate = new Date(item.borrowDate).toLocaleDateString();
    const dueDate = new Date(item.dueDate).toLocaleDateString();
    const currentPenalty = computeCurrentPenalty(item.dueDate);
    const isOverdue = currentPenalty > 0;
    return (
      <View style={[styles.itemRowBorrowed, isOverdue && styles.overdueRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sub}>Borrower: {item.borrower}</Text>
          <Text style={styles.sub}>Borrowed: {borrowDate}</Text>
          <Text style={styles.sub}>Due: {dueDate}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.penalty, isOverdue && styles.overduePenalty]}>Penalty: PHP {currentPenalty}</Text>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={() => handleReturn(item)}
          >
            <Text style={{ color: 'white' }}>Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>CD Library</Text>

      <View style={styles.totalsRow}>
        <Text style={styles.totalText}>Total Income: PHP {totalIncome}</Text>
        <Text style={styles.totalText}>Total Borrowed (all time): {totalBorrowedAllTime}</Text>
      </View>

      <Text style={styles.sectionTitle}>Available CDs</Text>
      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={renderInventoryItem}
        style={{ maxHeight: 240 }}
      />

      <Text style={styles.sectionTitle}>Borrowed CDs</Text>
      <FlatList
        data={borrowed}
        keyExtractor={(item) => item.id}
        renderItem={renderBorrowedItem}
        ListEmptyComponent={<Text style={{ color: '#666' }}>No borrowed CDs</Text>}
      />

      <Modal visible={borrowModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Borrow CD</Text>
            {selectedCD && (
              <Text style={{ marginBottom: 8 }}>{selectedCD.title} — {selectedCD.artist}</Text>
            )}
            <TextInput
              placeholder="Borrower name"
              value={borrowerName}
              onChangeText={setBorrowerName}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setBorrowModalVisible(false)} style={styles.modalBtn}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBorrow} style={[styles.modalBtn, { backgroundColor: '#007bff' }]}> 
                <Text style={{ color: 'white' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontSize: 18, marginTop: 12, marginBottom: 6, fontWeight: '600' },
  itemRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  itemRowBorrowed: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center', backgroundColor: '#fff7f7' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#555' },
  copies: { fontWeight: '600', marginBottom: 6 },
  borrowButton: { backgroundColor: '#28a745', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  borrowButtonDisabled: { backgroundColor: '#a9a9a9' },
  returnButton: { backgroundColor: '#dc3545', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  penalty: { fontWeight: '700', color: '#b71c1c', marginBottom: 6 },
  notAvailable: { color: '#b71c1c', fontWeight: '600', marginBottom: 6 },
  unavailableCopies: { color: '#b71c1c' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalText: { fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', padding: 16, borderRadius: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: Platform.OS === 'ios' ? 12 : 8, borderRadius: 6, marginBottom: 12 },
  modalBtn: { padding: 8, marginLeft: 8 }
});
