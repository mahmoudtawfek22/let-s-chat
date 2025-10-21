import { Component, signal } from '@angular/core';
import { LoginComponent } from './components/login-component/login-component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('letsChat');
}
