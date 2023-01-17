import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AddressFromEditorComponent, ConfigurationGuard } from './addressfromeditor/addressfromeditor.component';
import { ErrorComponent } from './static/error.component';

const routes: Routes = [
  { path: '', component: AddressFromEditorComponent, canActivate: [ConfigurationGuard] },
  { path: 'error', component: ErrorComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
