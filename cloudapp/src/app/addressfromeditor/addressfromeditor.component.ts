import { Component, OnInit, Injectable } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, RestErrorResponse, AlertService, Request, HttpMethod } from '@exlibris/exl-cloudapp-angular-lib';
import { map, catchError, switchMap, tap, concatMap, toArray, filter, finalize } from 'rxjs/operators';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of, from, forkJoin } from 'rxjs';
import { AppService } from '../app.service';
import { Letter } from './letter';
import { ErrorMessages } from '../static/error.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-addressfromeditor',
  templateUrl: './addressfromeditor.component.html',
  styleUrls: ['./addressfromeditor.component.scss']
})

export class AddressFromEditorComponent implements OnInit {
  letters?: Letter[];
  num = 100;
  loading = false;
  processed = 0;
  showProgress = false;
  dirtyControls: { [key: string]: number } = {};

  // we want to use the 'name' from /conf/letters
  // instead of the 'description' from /conf/code-tables
  // so that it matches what Alma displays in 'Letters Configuration'
  letterDescriptions = new Map<string, string>();

  labelLinks = new Map<string, string>();

  constructor( 
    private restService: CloudAppRestService,
    private appService: AppService,
    private alert: AlertService,
  ) { }

  ngOnInit() {
  }

  loadLetters() {
    this.loading = true;
    this.clearLetters();
    this.processed = 0;
    this.showProgress = false;
    this.num = 0;
    this.restService.call('/conf/letters')
    .pipe(
      concatMap((l: any) => l.letter ),
      filter((l: any) => l.enabled.value==='true'),
      filter((l: any) => l.channel==='EMAIL'),
      tap(() => this.num++),
      tap((l: any) => {
        this.letterDescriptions.set(l.code, l.name);
        this.labelLinks.set(l.code, l.labels.link);
      }),
      map((l: any) => this.getLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs => forkJoin(reqs)),
      finalize(() => this.loading = false),
    ).subscribe(
        {
        next: (s: any[])=>{
          s.forEach(letter=>{
            if (isRestErrorResponse(letter)) {
              console.log(`Error retrieving letter: ${letter.message}`);
            } else {
              let l: Letter = new Letter(letter);
              l.description = this.letterDescriptions.get(l.name);
              this.letters.push(l);
            }
          })
        },
        error: e => this.alert.error('Error in loadLetters(): ', e.message),
        complete: () => this.sortLetters(),
        }
    );
  }

  getLetter(letter: any) {
    return this.restService.call(this.labelLinks.get(letter.code)).pipe(
      tap(() => this.processed++ ),
      tap(() => console.log(`getting ${letter.description}`)),
      catchError(e => of(e)),
    )
  }

  updateLetters() {
    this.loading = true;
    this.clearDirtyControlsFlag();
    this.processed = 0;
    this.showProgress = false;
    this.num = 0;
    from(this.getUpdatedLetters())
    .pipe(
      map(l=>this.updateLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs=>forkJoin(reqs)),
      finalize(() => this.loading = false),
    )
    .subscribe({
      next: (s: any[]) => {
        s.forEach(letter=>{
          if (isRestErrorResponse(letter)) {
            console.log(`Error updating letter: ${letter.message}`);
            this.alert.error(`Error updating letter: ${letter.message}`);
          } else {
            let newLetter = new Letter(letter);
            newLetter.description = this.letterDescriptions.get(newLetter.name);
            let found = this.letters.findIndex((obj) => {
              return obj.name === newLetter.name;
            });
            if (found === -1) {
              this.alert.error(`Internal error: Couldn't find cached Letter object: ${newLetter.description}`);
            } else {
              this.letters[found] = newLetter;
              console.log(`refreshed cached Letter object: ${newLetter.description}`)
            }
          }
        })
      },
      error: e => this.alert.error('Error in updateLetters(): ', e.message),
    });
  }

  getUpdatedLetters() {
    let updatedLetters: Letter[] = new Array();
    this.num = 0;
    this.letters.forEach(l=> {
      if (l.isDirty()) {
        this.num++;
        updatedLetters.push(l);
      }
    })
    if (this.num < 1) { 
      this.alert.success('Nothing to update');
    }
    return updatedLetters;
  }

  updateLetter(letter: Letter) {
    letter.setAddressFrom(letter.addressFrom, letter.addressFromEnabled);
    const requestBody = letter.restObject;
    let request: Request = {
      url: this.labelLinks.get(letter.name),
      method: HttpMethod.PUT,
      requestBody
    };
    return this.restService.call(request).pipe(
      tap(() => this.processed++ ),
      tap(() => console.log(`updating ${letter.description}`)),
      catchError(e => of(e)),
    )
  }

  clearLetters() {
    this.letters = [];
    this.clearDirtyControlsFlag();
  }

  dirtyLetters() {
    return Object.keys(this.dirtyControls).length;
  }

  addressFromEnabledChanged(newVal, letter) {
    letter.addressFromEnabled = newVal;
    this.controlChanged(letter);
  }
  addressFromChanged(newVal, letter) 
  {
    letter.addressFrom = newVal;
    this.controlChanged(letter);
  }

  controlChanged(letter: Letter) {
    if (letter.isDirty()) {
      this.dirtyControls[letter.name] = 1;
    } else {
     delete this.dirtyControls[letter.name];
    }
  }

  clearDirtyControlsFlag() {
    this.dirtyControls = {};
  }

  sortLetters() {
    this.letters?.sort((a,b) => {
      /*
      // If we want to put disabled controls at the end, use this:
      let  enabledValue: number = (a.addressFromEnabled ? 0 : 1) - (b.addressFromEnabled ? 0 : 1);
      return enabledValue || a.addressFrom.localeCompare(b.addressFrom) || a.description.localeCompare(b.description);
      */
      return a.addressFrom.localeCompare(b.addressFrom) || a.description.localeCompare(b.description);
    });
  }

  sortLettersByName() {
    this.letters?.sort((a,b) => {
      return a.description.localeCompare(b.description);
    });
  }
    
  get percentComplete() {
    return Math.round((this.processed/this.num)*100)
  }

  private tryParseJson(value: any) {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(e);
    }
    return undefined;
  }

}

const isRestErrorResponse = (object: any): object is RestErrorResponse => 'error' in object;

@Injectable({
  providedIn: 'root',
})
export class ConfigurationGuard implements CanActivate {
  constructor(
    private eventsService: CloudAppEventsService,
    private router: Router
  ) {}
  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> {
      return this.eventsService.getInitData().pipe(map( data => {
        // console.log(`user: ${JSON.stringify(data.user)}`);
        if (!data.user.isAdmin) {
          this.router.navigate(['/error'],
            { queryParams: { error: ErrorMessages.NO_ACCESS }});
          return false;
        }
        return true;
      }))
  }
}