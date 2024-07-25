import { Component, OnInit, Injectable } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, RestErrorResponse, AlertService, Request, HttpMethod } from '@exlibris/exl-cloudapp-angular-lib';
import { map, catchError, switchMap, mergeMap, tap, toArray, filter, finalize, take } from 'rxjs/operators';
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
  languagesLoaded = false;
  processed = 0;
  showProgress = false;
  dirtyControls: { [key: string]: number } = {};

  // we want to use the 'name' from /conf/letters
  // instead of the 'description' from /conf/code-tables
  // so that it matches what Alma displays in 'Letters Configuration'
  letterDescriptions = new Map<string, string>();

  labelLinks = new Map<string, string>();

  languages = new Array<string>();
  letterMapByLanguage = new Map<string , Map<string, Letter>>();
  selectedLanguage = 'en'; // default
  selectedLanguages = new Array<string>();

  constructor( 
    private restService: CloudAppRestService,
    private appService: AppService,
    private alert: AlertService,
  ) { }

  ngOnInit() {
    this.loadLanguages();
  }

  languageChanged(newVal, lang) {
    console.log(`selectedLanguage: ${this.selectedLanguage}`);
    this.populateSelectedLanguages();
    this.clearLetters();
  }
  
  // Hack alert: When we make an API call using the 'lang' parameter, Alma seems to get confused and begins
  // to translate future Alma pages using the most recent language used in the 'lang' parameter value.
  // Making a final random API call with an empty 'lang' parameter seems to remedy this
  resetToDefaultLanguage() {
    let firstLabelLink = this.labelLinks.values().next().value;
    let url = firstLabelLink + this.languageParameter(''); 
    //console.log(`languageReset: ${firstLabelLink} , url: ${url}`);
    this.restService.call(url).subscribe({
        next: (s: any)=>{
          //console.log(`resetToDefaultLanguage() call finished: ${JSON.stringify(s)}`);
        }
    });
  }

  // for scalability reasons (Alma API calls will timeout if > 30 sec),
  // we can only process up to two languages at a time
  // with English necessarily being one of them.
  // This is because English is treated as the 'base' language, whereas
  // all other languages are considered 'translations'.
  populateSelectedLanguages() {
    this.selectedLanguages = new Array<string>();
    this.selectedLanguages.push('en');
    // English language is always necessary in Alma apparently
    if (this.selectedLanguage != 'en') 
      this.selectedLanguages.push(this.selectedLanguage);
    console.log(`selectedLanguages: ${this.selectedLanguages} (${this.selectedLanguages.length})`);
  }

  loadLanguages() {
    this.restService.call('/conf/mapping-tables/InstitutionLanguages')
    .pipe(
      mergeMap((l: any) => l.row ),
      filter((l: any) => l.enabled),
      toArray(),
    ).subscribe({
        next: (s: any[])=>{
          s.forEach(lang=>{
            if (isRestErrorResponse(lang)) {
              console.log(`Error retrieving languages: ${lang.message}`);
            } else {
              // since English code-table is always necessary, no need to keep track of it
              console.log(`Loaded language: ${lang.column0}`);
              if (lang.column0 != 'en') {
                this.selectedLanguage = lang.column0; // just set default as the most recent one encountered
                this.languages.push(lang.column0);
              }
            }
          });
          this.populateSelectedLanguages();
        },
        error: e => this.alert.error('Error in loadLanguages(): ', e.message),
        complete: () => {
          this.letterMapByLanguage.set('en', new Map<string, Letter>());
          this.languages.forEach(l=>{
            this.letterMapByLanguage.set(l, new Map<string, Letter>());
          });
          console.log('Finished loading languages')
          this.languagesLoaded = true;
        },
      }
    );
  }

  loadLetters() {
    this.loading = true;
    this.clearLetters();
    this.processed = 0;
    this.showProgress = false;
    this.num = 0;
    let url = '/conf/letters';
    this.restService.call(url)
    .pipe(
      mergeMap((l: any) => l.letter ),
      filter((l: any) => l.enabled.value==='true'),
      filter((l: any) => l.channel==='EMAIL'),
      tap(() => this.num+=this.selectedLanguages.length),
      tap((l: any) => {
        this.letterDescriptions.set(l.code, l.name);
        this.labelLinks.set(l.code, l.labels.link);
      }),
      //take(10), // for debugging, only work with small subset
      mergeMap((l: any) => this.getLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs => forkJoin(reqs)),
      finalize(() => {this.loading = false; this.resetToDefaultLanguage()}),
    ).subscribe({
        next: (s: any)=>{
          let keepGoing = true;
          s.forEach(letter=>{
            if (keepGoing) {
              if (isRestErrorResponse(letter)) {
                console.log(`Error retrieving letter: ${letter.message}`);
                keepGoing = false;
              } else {
                let l: Letter = new Letter(letter);
                let letterMap: Map<string, Letter> = this.letterMapByLanguage.get(letter.language.value);
                console.log(`caching ${letter.language.value} : ${letter.description}`);
                letterMap.set(l.name, l);

                //////////////
                // if multiple languages are enabled in Alma, there will be multiple versions of each letter
                // populate only one of each letter into letters[]
                let found = this.letters.findIndex((obj) => {
                  return obj.name === l.name;
                });
                if (found === -1) {
                  l.description = this.letterDescriptions.get(l.name);
                  this.letters.push(l);
                }
                //////////////
              }
            }
          });

        },
        error: e => this.alert.error('Error in loadLetters(): ', e.message),
        complete: () => this.sortLetters(),
        });
  }

  getLetter(letter: any) {
    const observableArray = [];
    this.selectedLanguages.forEach(lang=>{
      let url = this.labelLinks.get(letter.code) + this.languageParameter(lang); 
      observableArray.push(
        this.restService.call(url).pipe(
          tap(() => this.processed++ ),
          tap(() => console.log(`getting ${letter.description} ; lang ${lang}`)),
          catchError(e => of(e)),
        )
      );
    });
    return observableArray;
  }

  updateLetters() {
    this.loading = true;
    this.clearDirtyControlsFlag();
    this.processed = 0;
    this.showProgress = false;
    this.num = 0;
    from(this.getUpdatedLetters())
    .pipe(
      mergeMap((l: any) => this.updateLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs=>forkJoin(reqs)),
      finalize(() => {this.loading = false; this.resetToDefaultLanguage()}),
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
        });
      },
      error: e => this.alert.error('Error in updateLetters(): ', e.message),
    });
  }

  getUpdatedLetters() {
    let updatedLetters: Letter[] = new Array();
    this.num = 0;
    this.letters.forEach(l=> {
      if (l.isDirty()) {
        this.num+=this.selectedLanguages.length;
        updatedLetters.push(l);
      }
    })
    if (this.num < 1) { 
      this.alert.success('Nothing to update');
    }
    return updatedLetters;
  }

  updateLetter(letter: Letter) {
    const observableArray = [];
    this.selectedLanguages.forEach(lang=>{
      let letterMap: Map<string, Letter> = this.letterMapByLanguage.get(lang);
      let thisLetter: Letter = letterMap.get(letter.name);

      let url =  this.labelLinks.get(letter.name) + this.languageParameter(lang); 
      thisLetter.setAddressFrom(letter.addressFrom, letter.addressFromEnabled);
      const requestBody = thisLetter.restObject;
      //console.log(`lang:${lang} requestBody: ${JSON.stringify(requestBody)}`);
      let request: Request = {
        url: url,
        method: HttpMethod.PUT,
        requestBody
      };
      observableArray.push(
        this.restService.call(request).pipe(
          tap(() => this.processed++ ),
          tap(() => console.log(`updating ${letter.description}`)),
          catchError(e => of(e)),
        )
      );
    });

    return observableArray;

  }

  clearLetters() {
    this.letters = [];
    this.clearDirtyControlsFlag();
    this.letterDescriptions = new Map<string, string>();
    this.labelLinks = new Map<string, string>();
  }

  dirtyLetters() {
    return Object.keys(this.dirtyControls).length;
  }

  // helper
  languageParameter(lang) {
    return ('?lang=' + lang);
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
