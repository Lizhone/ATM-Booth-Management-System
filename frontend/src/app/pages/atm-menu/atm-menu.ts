
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Atm } from '../../services/atm';

interface TransactionRecord {
  transaction_id: number;
  transaction_type: string;
  amount: number;
  transaction_date: string | null;
  description: string | null;
}

@Component({
  selector: 'app-atm-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './atm-menu.html',
  styleUrl: './atm-menu.css'
})
export class AtmMenu {
  customer: any = null;
  selectedOption = '';

  today = new Date();

  amount: number | null = null;
  pin = '';
  balanceVerified = false;

  // Transaction success screen
  transactionSuccess = false;
  successType = '';
  successAmount = 0;
  successBalance: number | null = null;

  // PIN change fields
  oldPin = '';
  newPin = '';
  confirmPin = '';

  // Transaction results
  balance: number | null = null;
  transactions: TransactionRecord[] = [];

  // UI status
  message = '';
  isLoading = false;
  statementLoaded = false;

  readonly fastCashAmounts = [500, 1000, 2000, 3000, 5000];

  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    private atm: Atm,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadCustomer();
    }
  }

  private loadCustomer(): void {
    try {
      const savedCustomer = sessionStorage.getItem('atmCustomer');

      if (!savedCustomer) {
        this.router.navigate(['/']);
        return;
      }

      this.customer = JSON.parse(savedCustomer);

      if (!this.customer?.account_number) {
        sessionStorage.removeItem('atmCustomer');
        this.router.navigate(['/']);
      }
    } catch {
      sessionStorage.removeItem('atmCustomer');
      this.router.navigate(['/']);
    }
  }
selectOption(option: string): void {
  this.selectedOption = option;
  this.resetTransactionForm();

  this.balance = null;
  this.balanceVerified = false;

  console.log('Selected option:', option);
  console.log('Balance:', this.balance);
  console.log('Balance verified:', this.balanceVerified);
}
backToMenu(): void {
  this.selectedOption = '';
  this.transactionSuccess = false;
  this.resetTransactionForm();
}

 private resetTransactionForm(): void {
  this.amount = null;
  this.pin = '';
  this.oldPin = '';
  this.newPin = '';
  this.confirmPin = '';

  this.balance = null;
  this.balanceVerified = false;

  this.transactions = [];
  this.message = '';
  this.isLoading = false;
  this.statementLoaded = false;
}

  private get accountNumber(): string {
    return String(this.customer?.account_number ?? '');
  }

  private validPin(value: string): boolean {
    return /^\d{4}$/.test(value);
  }

  private validAmount(value: number | null): boolean {
    return (
      value !== null &&
      Number.isFinite(Number(value)) &&
      Number(value) > 0 &&
      Math.round(Number(value) * 100) === Number(value) * 100
    );
  }

  private handleError(error: any, fallback: string): void {
    this.message =
      error?.error?.message ||
      error?.message ||
      fallback;
  }

  // Display confirmation only after the backend confirms success.
  private showTransactionSuccess(
    type: string,
    amount: number,
    response: any
  ): void {
    this.successType = type;
    this.successAmount = amount;

    this.successBalance =
      response?.balance !== undefined &&
      response?.balance !== null &&
      Number.isFinite(Number(response.balance))
        ? Number(response.balance)
        : null;

    this.balance = this.successBalance;
    this.message = '';
    this.transactionSuccess = true;
  }

  // Return to the main ATM menu after confirmation.
  confirmSuccess(): void {
    this.transactionSuccess = false;
    this.selectedOption = '';
    this.resetTransactionForm();
  }

  submitTransaction(): void {
    if (this.isLoading) {
      return;
    }

    this.message = '';

    if (!this.accountNumber) {
      this.message = 'Account information is missing. Please log in again.';
      return;
    }

    switch (this.selectedOption) {
      case 'Deposit':
        this.submitDeposit();
        break;

      case 'Cash Withdrawal':
        this.submitWithdrawal();
        break;

      case 'Fast Cash':
        this.submitFastCash();
        break;

      case 'Mini Statement':
        this.loadMiniStatement();
        break;

      case 'Balance Enquiry':
        this.checkBalance();
        break;

      case 'PIN Change':
        this.changePin();
        break;

      default:
        this.message = 'Please select a valid transaction.';
    }
  }

  // Deposit money
  private submitDeposit(): void {
    if (!this.validPin(this.pin)) {
      this.message = 'Enter a valid 4-digit PIN.';
      return;
    }

    if (!this.validAmount(this.amount)) {
      this.message = 'Enter a valid deposit amount greater than zero.';
      return;
    }

    const depositAmount = Number(this.amount);
    this.isLoading = true;

    this.atm.deposit(
      this.accountNumber,
      this.pin,
      depositAmount
    ).subscribe({
      next: (response: any) => {
        this.showTransactionSuccess(
          'Deposit',
          depositAmount,
          response
        );

        this.amount = null;
        this.pin = '';
        this.isLoading = false;
      },
      error: (error: any) => {
        this.handleError(error, 'Deposit failed.');
        this.isLoading = false;
      }
    });
  }

  // Cash withdrawal
  private submitWithdrawal(): void {
    if (!this.validPin(this.pin)) {
      this.message = 'Enter a valid 4-digit PIN.';
      return;
    }

    if (!this.validAmount(this.amount)) {
      this.message = 'Enter a valid withdrawal amount greater than zero.';
      return;
    }

    const withdrawalAmount = Number(this.amount);
    this.isLoading = true;

    this.atm.withdraw(
      this.accountNumber,
      this.pin,
      withdrawalAmount
    ).subscribe({
      next: (response: any) => {
        this.showTransactionSuccess(
          'Cash Withdrawal',
          withdrawalAmount,
          response
        );

        this.amount = null;
        this.pin = '';
        this.isLoading = false;
      },
      error: (error: any) => {
        this.handleError(error, 'Withdrawal failed.');
        this.isLoading = false;
      }
    });
  }

  // Fast Cash withdrawal
  private submitFastCash(): void {
    if (!this.validPin(this.pin)) {
      this.message = 'Enter a valid 4-digit PIN.';
      return;
    }

    if (
      this.amount === null ||
      !this.fastCashAmounts.includes(Number(this.amount))
    ) {
      this.message = 'Select a valid Fast Cash amount.';
      return;
    }

    const cashAmount = Number(this.amount);
    this.isLoading = true;

    this.atm.fastCash(
      this.accountNumber,
      this.pin,
      cashAmount
    ).subscribe({
      next: (response: any) => {
        this.showTransactionSuccess(
          'Fast Cash Withdrawal',
          cashAmount,
          response
        );

        this.amount = null;
        this.pin = '';
        this.isLoading = false;
      },
      error: (error: any) => {
        this.handleError(error, 'Fast Cash withdrawal failed.');
        this.isLoading = false;
      }
    });
  }

  // Balance enquiry
 
private checkBalance(): void {
  this.balance = null;
  this.balanceVerified = true;
  this.message = '';

  if (!this.validPin(this.pin)) {
    this.message = 'Enter a valid 4-digit PIN.';
    return;
  }

  this.isLoading = true;

  this.atm.balanceEnquiry(this.accountNumber, this.pin).subscribe({
   next: (response: any) => {
  this.balance = Number(response.balance);
  this.balanceVerified = true;
  this.pin = '';
  this.isLoading = false;
},
    error: (error: any) => {
      this.balance = null;
      this.balanceVerified = false;
      this.handleError(error, 'Unable to retrieve balance.');
      this.isLoading = false;
    }
  });
}
//mini Statement
private loadMiniStatement(): void {
  if (!this.validPin(this.pin)) {
    this.message = 'Enter your valid 4-digit PIN.';
    return;
  }

  this.isLoading = true;
  this.statementLoaded = false;
  this.message = '';

  this.atm.miniStatement(this.accountNumber, this.pin).subscribe({
    next: (response: any) => {
      this.transactions = Array.isArray(response.transactions)
        ? response.transactions
        : [];

      this.balance = Number(response.balance);
      this.today = new Date();

      this.statementLoaded = true;
      this.pin = '';
      this.isLoading = false;

      // Open the separate receipt page after the response arrives.
      this.selectedOption = 'Mini Statement Receipt';

      console.log('Loaded transactions:', this.transactions);
      console.log('Loaded balance:', this.balance);
      console.log('Statement loaded:', this.statementLoaded);
    },

    error: (error: any) => {
      console.error('Mini statement error:', error);
      this.handleError(error, 'Unable to load mini statement.');
      this.isLoading = false;
    }
  });
}


  // Change PIN
  private changePin(): void {
    if (!this.validPin(this.oldPin)) {
      this.message = 'Enter your current 4-digit PIN.';
      return;
    }

    if (!this.validPin(this.newPin)) {
      this.message = 'Your new PIN must contain exactly four digits.';
      return;
    }

    if (this.newPin === this.oldPin) {
      this.message = 'New PIN must differ from the current PIN.';
      return;
    }

    if (this.newPin !== this.confirmPin) {
      this.message = 'The new PIN and confirmation do not match.';
      return;
    }

    this.isLoading = true;

    this.atm.changePin(
      this.accountNumber,
      this.oldPin,
      this.newPin,
      this.confirmPin
    ).subscribe({
      next: (response: any) => {
        this.message =
          response.message || 'PIN changed successfully.';

        this.oldPin = '';
        this.newPin = '';
        this.confirmPin = '';
        this.isLoading = false;
      },
      error: (error: any) => {
        this.handleError(error, 'Unable to change PIN.');
        this.isLoading = false;
      }
    });
  }

  // Exit ATM
  exit(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem('atmCustomer');
    }

    this.router.navigate(['/']);
  }
  
printStatement(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

}
