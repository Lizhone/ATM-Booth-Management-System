
import {
  Component,
  OnInit,
  AfterViewInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Atm } from '../../services/atm';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit, AfterViewInit {

  // Application details
  applicationNumber = 2103;
  currentPage = 1;

  // Page 1: Personal and contact details
  fullName = '';
  fatherName = '';
  dob = '';
  gender = '';
  email = '';
  phone = '';
  maritalStatus = '';
  address = '';
  city = '';
  pinCode = '';
  state = '';

  // Page 2: Additional details
  religion = '';
  category = '';
  income = '';
  education = '';
  occupation = '';
  panNumber = '';
  aadhaarNumber = '';
  seniorCitizen = '';
  existingAccount = '';

  // Page 3: Account details
  accountType = '';
  cardNumber = '';
  pin = '';
  accountPin = '';
  servicesRequired: string[] = [];
  declarationAccepted = false;

  // Registration status
  applicationSubmitted = false;
  generatedCardNumber = '';
  generatedCardPin = '';
  accountNumber = '';
  message = '';
  isLoading = false;

  constructor(private atm: Atm) {}

  // Initialize application number
  ngOnInit(): void {
    const savedNumber = localStorage.getItem(
      'lastApplicationNumber'
    );

    if (savedNumber) {
      this.applicationNumber = Number(savedNumber) + 1;
    }
  }

  ngAfterViewInit(): void {
    this.scrollToTop();
  }

  // Page 1 -> Page 2
  nextPage(): void {
    this.message = '';

    if (this.currentPage === 1) {
      if (
        !this.fullName.trim() ||
        !this.fatherName.trim() ||
        !this.dob ||
        !this.gender ||
        !this.email.trim() ||
        !this.phone.trim() ||
        !this.maritalStatus ||
        !this.address.trim() ||
        !this.city.trim() ||
        !this.pinCode.trim() ||
        !this.state
      ) {
        this.message =
          'Please complete all required personal details.';
        return;
      }

      if (!/^\d{6}$/.test(this.pinCode.trim())) {
        this.message = 'Enter a valid 6-digit PIN code.';
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())
      ) {
        this.message = 'Enter a valid email address.';
        return;
      }

      if (this.dob > this.getTodayDate()) {
        this.message = 'Date of birth cannot be in the future.';
        return;
      }
    }

    if (this.currentPage < 3) {
      this.currentPage++;
      this.scrollToTop();
    }
  }

  // Return to the previous page
  previousPage(): void {
    this.message = '';

    if (this.currentPage > 1) {
      this.currentPage--;
      this.scrollToTop();
    }
  }

  // Page 2 -> Page 3
  
goToAccountDetails(): void {
  this.message = '';

  if (
    !this.religion ||
    !this.category ||
    !this.income ||
    !this.education ||
    !this.occupation ||
    !this.panNumber.trim() ||
    !this.aadhaarNumber.trim() ||
    !this.seniorCitizen ||
    !this.existingAccount
  ) {
    this.message =
      'Please complete all required additional details.';
    return;
  }

  // PAN validation temporarily disabled.

  if (!/^\d{12}$/.test(this.aadhaarNumber.trim())) {
    this.message = 'Enter a valid 12-digit Aadhaar number.';
    return;
  }

  this.currentPage = 3;
  this.scrollToTop();
}


  // Page 3 -> Page 2
  goToAdditionalDetails(): void {
    this.message = '';
    this.currentPage = 2;
    this.scrollToTop();
  }

  // Handle the service checkboxes in register.html
  onServiceChange(
    service: string,
    checked: boolean
  ): void {
    if (checked) {
      if (!this.servicesRequired.includes(service)) {
        this.servicesRequired.push(service);
      }
    } else {
      this.servicesRequired = this.servicesRequired.filter(
        item => item !== service
      );
    }
  }

  // Submit complete registration to Flask
 
submitApplication(): void {
  this.message = '';

  if (this.isLoading) {
    return;
  }

  if (!this.declarationAccepted) {
    this.message =
      'Please accept the declaration before submitting.';
    return;
  }

  if (!this.accountType) {
    this.message = 'Please select an account type.';
    return;
  }

  if (!this.pin.trim() || !this.accountPin.trim()) {
    this.message = 'Please enter and confirm your PIN.';
    return;
  }

  if (this.pin !== this.accountPin) {
    this.message =
      'The PIN and confirmation PIN do not match.';
    return;
  }

    // Use the exact field names expected by app.py.
    const registrationData: Record<string, unknown> = {
      full_name: this.fullName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      pin: this.pin,

      father_name: this.fatherName.trim(),
      dob: this.dob,
      gender: this.gender,
      marital_status: this.maritalStatus,
      address: this.address.trim(),
      city: this.city.trim(),
      pin_code: this.pinCode.trim(),
      state: this.state,

      religion: this.religion,
      category: this.category,
      income: this.income,
      education: this.education,
      occupation: this.occupation,
      pan_number: this.panNumber.trim().toUpperCase(),
      aadhaar_number: this.aadhaarNumber.trim(),
      senior_citizen: this.seniorCitizen,
      existing_account: this.existingAccount,

      account_type: this.accountType,
      services_required: this.servicesRequired
    };

    this.isLoading = true;

    this.atm.register(registrationData).subscribe({
      next: (response: any) => {
        this.accountNumber = String(
          response.account_number ?? ''
        );

        if (!this.accountNumber) {
          this.message =
            'Registration response did not contain an account number.';
          this.isLoading = false;
          return;
        }

        this.generatedCardNumber = this.accountNumber;

        // Never display the customer's PIN on the confirmation page.
        this.generatedCardPin = '';

        this.applicationSubmitted = true;
        this.isLoading = false;

        localStorage.setItem(
          'lastApplicationNumber',
          String(this.applicationNumber)
        );

        // Clear PIN values after successful registration.
        this.pin = '';
        this.accountPin = '';

        this.scrollToTop();
      },

      error: (error: any) => {
        this.isLoading = false;

        this.message =
          error?.error?.message ||
          error?.error?.error ||
          'Registration failed. Please check your details and try again.';
      }
    });
  }

  // Finish after successful registration
  finishApplication(): void {
    this.resetForm();
    this.applicationNumber++;
    this.currentPage = 1;
    this.scrollToTop();
  }

  // Cancel the current application
  cancelApplication(): void {
    this.resetForm();
    this.currentPage = 1;
    this.scrollToTop();
  }

  // Reset all form values
  private resetForm(): void {
    this.fullName = '';
    this.fatherName = '';
    this.dob = '';
    this.gender = '';
    this.email = '';
    this.phone = '';
    this.maritalStatus = '';
    this.address = '';
    this.city = '';
    this.pinCode = '';
    this.state = '';

    this.religion = '';
    this.category = '';
    this.income = '';
    this.education = '';
    this.occupation = '';
    this.panNumber = '';
    this.aadhaarNumber = '';
    this.seniorCitizen = '';
    this.existingAccount = '';

    this.accountType = '';
    this.cardNumber = '';
    this.pin = '';
    this.accountPin = '';
    this.servicesRequired = [];
    this.declarationAccepted = false;

    this.applicationSubmitted = false;
    this.generatedCardNumber = '';
    this.generatedCardPin = '';
    this.accountNumber = '';
    this.message = '';
    this.isLoading = false;
  }

  // Return today's date in YYYY-MM-DD format
  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Scroll to the top of the current page
  private scrollToTop(): void {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }
}
