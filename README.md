# CD Library React Native App

This is a simple React Native (Expo) app for managing CD borrowing and returns. It tracks inventory, borrowed records with due dates, penalties for overdue returns, total income, and total borrowed CDs of all time. Data is persisted using AsyncStorage.

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Install Expo CLI (if you don't have it):

```bash
npx expo install -g expo-cli
```

3. Run the app:

```bash
npm start
```

Features implemented to meet the rubric:
- Initialize CD Inventory with title, artist, and quantity.
- Home Screen lists Available CDs and Borrowed CDs with borrower, borrow date, due date, and current penalty.
- Borrowing reduces copies and records borrow/due dates; prevents borrowing when none available.
- Returning increases copies, calculates penalty (PHP2/day overdue), updates total income, and removes borrowed record.
- All data persisted using AsyncStorage.

Notes for submission:
- Provide a short demo video showing borrowing, overdue penalty, return, and app restart to demonstrate persistence.
