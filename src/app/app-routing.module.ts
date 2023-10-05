import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewerComponent } from './viewer/viewer.component';
import { UserRegisterComponent } from './user-register/user-register.component';

const routes: Routes = [
  { path: '', component: ViewerComponent },
  { path: 'welcome', component: UserRegisterComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
