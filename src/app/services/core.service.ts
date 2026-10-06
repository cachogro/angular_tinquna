import { Injectable, signal } from '@angular/core';
import { AppSettings, defaults } from '../config';

@Injectable({
    providedIn: 'root',
})
export class CoreService {
    private optionsSignal = signal<AppSettings>(defaults);

    // Sidebar colapsado a solo iconos (escritorio/tablet). Lo mantiene FullComponent.
    readonly sidebarMini = signal(false);

    getOptions() {
        return this.optionsSignal();
    }

    setOptions(options: Partial<AppSettings>) {
        this.optionsSignal.update((current) => ({
            ...current,
            ...options,
        }));
    }

}
