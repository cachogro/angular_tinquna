import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import {
  Component,
  OnInit,
  signal,
  ViewChild,
  ViewEncapsulation,
  effect, // <-- Importado para reaccionar a la Signal
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';

import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';

import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AppNavItemComponent } from './sidebar/nav-item/nav-item.component';
import { navItems } from './sidebar/sidebar-data';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { OverlayContainer } from '@angular/cdk/overlay'; // <-- Importado para los diálogos
import { FilterByRolePipe } from 'src/app/shared/pipes/filter-by-role.pipe';

const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';

@Component({
  selector: 'app-full',
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    SidebarComponent,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
    MatButtonModule,
    FilterByRolePipe,
  ],
  templateUrl: './full.component.html',
  styleUrls: [],
  encapsulation: ViewEncapsulation.None,
})
export class FullComponent implements OnInit {
  navItems = navItems;

  //------------tema obscuro-------------------
  isDarkMode = signal<boolean>(false);

  @ViewChild('leftsidenav')
  public sidenav: MatSidenav;
  resView = false;

  @ViewChild('content', { static: true }) content!: MatSidenavContent;
  //get options from service
  options = this.settings.getOptions();
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private isContentWidthFixed = true;
  private isCollapsedWidthFixed = false;
  private htmlElement!: HTMLHtmlElement;

  private authService: AuthService;

  get isOver(): boolean {
    return this.isMobileScreen;
  }

  constructor(
    private settings: CoreService,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private overlayContainer: OverlayContainer, // <-- Inyectado aquí
  ) {
    this.htmlElement = document.querySelector('html')!;

    // === REACCIÓN AUTOMÁTICA PARA LOS DIÁLOGOS (OVERLAY) ===
    effect(() => {
      const darkActive = this.isDarkMode();
      const containerElement = this.overlayContainer.getContainerElement();

      if (darkActive) {
        containerElement.classList.add('dark-theme');
        containerElement.classList.remove('light-theme');
      } else {
        containerElement.classList.add('light-theme');
        containerElement.classList.remove('dark-theme');
      }
    });
    // =======================================================

    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW])
      .subscribe((state) => {
        // SidenavOpened must be reset true when layout changes
        this.options.sidenavOpened = true;
        this.isMobileScreen = state.breakpoints[MOBILE_VIEW];
        if (this.options.sidenavCollapsed == false) {
          this.options.sidenavCollapsed = state.breakpoints[TABLET_VIEW];
        }
      });

    // Initialize project theme with options

    // This is for scroll to top
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e) => {
        this.content.scrollTo({ top: 0 });
      });
  }

  ngOnInit(): void {}

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
  }

  toggleCollapsed() {
    this.isContentWidthFixed = false;
    this.options.sidenavCollapsed = !this.options.sidenavCollapsed;
    this.resetCollapsedState();
  }

  resetCollapsedState(timer = 400) {
    setTimeout(() => this.settings.setOptions(this.options), timer);
  }

  onSidenavClosedStart() {
    this.isContentWidthFixed = false;
  }

  onSidenavOpenedChange(isOpened: boolean) {
    this.isCollapsedWidthFixed = !this.isOver;
    this.options.sidenavOpened = isOpened;
  }

  toggleTheme(): void {
    this.isDarkMode.update((value) => !value);
  }
}
