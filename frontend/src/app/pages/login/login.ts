
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Atm } from '../../services/atm';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  accountNumber = '';
  pin = '';
  message = '';
  isLoading = false;

  constructor(
    private atm: Atm,
    private router: Router
  ) {}

  onLogin(): void {
    this.message = '';

    if (!this.accountNumber.trim() || !this.pin.trim()) {
      this.message = 'Please enter your account number and PIN.';
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.atm.login(this.accountNumber.trim(), this.pin).subscribe({
      next: (response: any) => {
        this.isLoading = false;

        // Store the logged-in customer's account details.
        sessionStorage.setItem(
          'atmCustomer',
          JSON.stringify(response.customer)
        );

        // Navigate to the ATM Main Menu.
        this.router.navigate(['/atm-menu']);
      },

      error: (error: any) => {
        this.message =
          error.error?.message ||
          'Unable to log in. Please try again.';

        this.isLoading = false;
      }
    });
  }
}
