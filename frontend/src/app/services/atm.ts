
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Atm {
  private apiUrl = 'http://127.0.0.1:5000/api';

  constructor(private http: HttpClient) {}

  // Login using account number and PIN
  login(accountNumber: string, pin: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, {
      account_number: accountNumber,
      pin: pin
    });
  }

  // Register a customer
  register(data: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  // Balance enquiry
  balanceEnquiry(
    accountNumber: string,
    pin: string
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/balance`, {
      account_number: accountNumber,
      pin: pin
    });
  }

  // Deposit money
  deposit(
    accountNumber: string,
    pin: string,
    amount: number
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/deposit`, {
      account_number: accountNumber,
      pin: pin,
      amount: amount
    });
  }

  // Cash withdrawal
  withdraw(
    accountNumber: string,
    pin: string,
    amount: number
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/withdraw`, {
      account_number: accountNumber,
      pin: pin,
      amount: amount
    });
  }

  // Fast Cash withdrawal
  fastCash(
    accountNumber: string,
    pin: string,
    amount: number
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/fast-cash`, {
      account_number: accountNumber,
      pin: pin,
      amount: amount
    });
  }

  // Retrieve the latest five transactions
  miniStatement(
    accountNumber: string,
    pin: string
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/mini-statement`, {
      account_number: accountNumber,
      pin: pin
    });
  }

  // Change the account PIN
  changePin(
    accountNumber: string,
    oldPin: string,
    newPin: string,
    confirmPin: string
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-pin`, {
      account_number: accountNumber,
      old_pin: oldPin,
      new_pin: newPin,
      confirm_pin: confirmPin
    });
  }
}
