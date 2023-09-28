import { Component } from '@angular/core';
import { JS_SERVER } from '../viewer/util/viewer.const';

@Component({
  selector: 'app-user-register',
  templateUrl: './user-register.component.html'
})
export class UserRegisterComponent {

  userName = '';
  userEmail = '';
  error = {
    name: null,
    email: null
  }

  constructor() {}

  onSubmit(): void {
    let hasError = false
    this.error.name = null
    this.error.email = null
    if (this.userName.length === 0) {
      this.error.name = 'No name provided'
      hasError = true
    }
    if (this.userEmail.length === 0) {
      this.error.email = 'No email provided'
      hasError = true
    }
    if (hasError) { return }
    fetch(JS_SERVER + 'reg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: this.userName,
        email: this.userEmail
      })
    }).then(()=> {
      window.location.href = window.location.origin
    })
    this.userName = ''
    this.userEmail = ''
    return
  }

}
