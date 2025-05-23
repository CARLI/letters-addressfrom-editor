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

  setAllValues = '';

  showEnabledLetters = true;
  showDisabledLetters = false;

  // we want to use the 'name' from /conf/letters
  // instead of the 'description' from /conf/code-tables
  // so that it matches what Alma displays in 'Letters Configuration'
  letterDescriptions = new Map<string, string>();
  labelLinks = new Map<string, string>();
  letterDescriptionsAndLinksLoaded = false;

  languages = new Array<string>();
  selectedLanguage = 'en'; // default

  // sometimes Alma needs to be 'nudged' in order to acknowledge new Translations
  // updating the en code-table seems to work
  translatedLettersNeededToBeUpdatedAgain = new Array<Letter>();

  constructor( 
    private restService: CloudAppRestService,
    private appService: AppService,
    private alert: AlertService,
  ) { }

  ngOnInit() {
    this.loadLanguages();
  }
  
  // Hack alert: When we make an API call using the 'lang' parameter, Alma seems to get confused and begins
  // to translate future Alma pages using the most recent language used in the 'lang' parameter value.
  // Making a final random API call with an empty 'lang' parameter seems to remedy this
  resetToDefaultLanguage() {
    let firstLabelLink = this.labelLinks.values().next().value;
    let url = firstLabelLink + this.languageParameter(''); 
    //console.log(`languageReset: ${firstLabelLink} , url: ${url}`);
    this.loading = true;
    this.restService.call(url)
    .pipe(
      finalize(() => this.loading = false),
    ).subscribe({
        next: (s: any)=>{
          console.log(`resetToDefaultLanguage() call finished`);
        }
    });
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
              console.log(`Error retrieving languages: ${JSON.stringify(lang)}`);
            } else {
              // since English code-table is always necessary, no need to keep track of it
              console.log(`Loaded language: ${lang.column0}`);
              if (lang.column0 != 'en') {
                this.selectedLanguage = lang.column0; // just set default as the most recent one encountered
                this.languages.push(lang.column0);
              }
            }
          });
        },
        error: e => this.alert.error('Error in loadLanguages(): ', e.message),
        complete: () => {
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
    this.restService.call('/conf/letters')
    .pipe(
      mergeMap((l: any) => l.letter ),
      filter((l: any) => l.enabled.value==='true'),
      filter((l: any) => l.channel==='EMAIL'),
      tap(() => this.num++),
  //take(3),
      tap((l: any) => {
        if (! this.letterDescriptionsAndLinksLoaded) {
          this.letterDescriptions.set(l.code, l.name);
          this.labelLinks.set(l.code, l.labels.link);
        }
      }),
      map((l: any) => this.getEnLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs => forkJoin(reqs)),
      finalize(() => this.loading = false),
    ).subscribe({
      next: (s: any)=>{
        s.forEach(letter=>{
          if (isRestErrorResponse(letter)) {
            console.log(`Error retrieving letter: ${JSON.stringify(letter)}`);
          } else {
            let l: Letter = new Letter(letter);
            l.description = this.letterDescriptions.get(l.name);
            // if this "row" does not exist in the JSON object, then we can't modify it
            // (nor can we add it -- I tried to do this and the API doesn't accept it)
            // so we will ignore these letters
            // (currently, I've only identified one such letter, ResourceSharingConversationLetter,
            // but there may be more)
            const containsAddressFromLabel = letter.row.some(obj => obj.code === "addressFrom");
            if (! containsAddressFromLabel) {
              console.log(`***letter: ${l.description} does not contain an addressFrom Label -- skipping***`);
            } else {
              this.letters.push(l);
            }
          }
        });
      },
      error: e => this.alert.error('Error in loadLetters(): ', e.message),
      complete: () => {
        this.letterDescriptionsAndLinksLoaded = true;
        this.sortLetters();
      },
    });
  }

  getEnLetter(letter: any) {
    let url = this.labelLinks.get(letter.code) + this.languageParameter('en'); 
    return this.restService.call(url).pipe(
      tap(() => console.log(`getting ${letter.description}`)),
      tap(() => this.processed++ ),
      catchError(e => of(e)),
    );
  }

  getLangLetter(letter: Letter, lang: string) {
    let url = this.labelLinks.get(letter.name) + this.languageParameter(lang); 
    return this.restService.call(url).pipe(
      tap(() => console.log(`getLangLetter, getting ${letter.description} ; lang ${lang}`)),
      tap(() => this.processed++ ),
      catchError(e => of(e)),
    );
  }

  updateTranslations() {
    this.loading = true;
    this.processed = 0;
    this.showProgress = false;
    this.num = this.letters.length;

    this.translatedLettersNeededToBeUpdatedAgain = new Array<Letter>();

    let translations: Letter[] = new Array<Letter>();

    from(this.letters)
    .pipe(
      map((l) => this.getLangLetter(l, this.selectedLanguage)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs => forkJoin(reqs)),
    ).subscribe({
      next: (s: any)=>{
        s.forEach(letter=>{
          if (isRestErrorResponse(letter)) {
            console.log(`Error retrieving letter: ${JSON.stringify(letter)}`);
          } else {
            let l: Letter = new Letter(letter);
            translations.push(l);
          }
        });
      },
      error: e => this.alert.error('Error in updateTranslations(): ', e.message),
      complete: () => this.updateTranslations2(translations),
    });
  }

  updateTranslations2(translationsToUpdate: Letter[]) {
    this.processed = 0;
    this.num = translationsToUpdate.length;
    from(translationsToUpdate)
    .pipe(
      map((l) => this.updateTranslation(l)),
      toArray(),
      switchMap(reqs=>forkJoin(reqs)),
    ).subscribe(
      {
      next: (s: any[]) => {
        s.forEach(letter=>{
          if (isRestErrorResponse(letter)) {
            console.log(`Error message received while updating translation: ${JSON.stringify(letter)}`);
          } else {
            console.log(`Processed translation for ${letter.description}`);
          }
        })
      },
      error: e => this.alert.error('Error in updateTranslations2(): ', e.message),
      complete: () => this.updateLetters(`Translations for '${this.selectedLanguage}' succeeded`, this.translatedLettersNeededToBeUpdatedAgain),
    });
  }

  updateTranslation(letter: Letter) {
    let enLetter: Letter = null;
    let found = this.letters.findIndex((obj) => {
      return obj.name === letter.name;
    });
    if (found === -1) {
      let errorMsg = `Internal error: Couldn't find cached Letter object: ${letter.description}`;
      this.alert.error(errorMsg);
      letter['error'] = errorMsg;
      return of(letter);
    } else {
      enLetter = this.letters[found];
      //console.log(`addressFrom value from cached ${enLetter.description} Letter object: ${enLetter.addressFrom}`)
    }

    this.translatedLettersNeededToBeUpdatedAgain.push(enLetter); // Alma needs you to re-update the en code-table in order for translation to take effect?
    letter.setAddressFrom(enLetter.addressFrom, enLetter.addressFromEnabled);
    const requestBody = letter.restObject;
    let url = this.labelLinks.get(letter.name) + this.languageParameter(this.selectedLanguage); 

    let request: Request = {
      url: url,
      method: HttpMethod.PUT,
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
      requestBody
    };
    return this.restService.call(request).pipe(
      tap(() => this.processed++ ),
      tap(() => console.log(`updating ${this.selectedLanguage} translation ${letter.description}`)),
      catchError(e => of(e)),
    )
  }

  updateLetters(alertMessage: string, lettersToUpdate: Letter[]) {
    this.loading = true;
    this.clearDirtyControlsFlag();
    this.processed = 0;
    this.showProgress = false;
    this.num = 0;
    let updateThese: Letter [];
    if (lettersToUpdate != null) {
      updateThese = lettersToUpdate;
    } else {
      updateThese = this.getUpdatedLetters();
    }
    from(updateThese)
    .pipe(
      tap(() => { if (lettersToUpdate != null) this.num++ }),
      map(l=>this.updateLetter(l)),
      toArray(),
      tap(() => this.showProgress = true),
      switchMap(reqs=>forkJoin(reqs)),
      finalize(() => {
        this.loading = false,
        this.resetToDefaultLanguage();
        this.alert.success(alertMessage, {delay: 5000});
      }),
    ).subscribe({
      next: (s: any[]) => {
        s.forEach(letter=>{
          if (isRestErrorResponse(letter)) {
            console.log(`Error updating letter: ${JSON.stringify(letter)}`);
            if (letter.status != 200) {
              // only alert user when we do not receive a HTTP/200
              // because it seems we're sometimes getting "false" error messages
              // like the following:
              //
              //{
              //  "ok": false,
              //  "status": 200,
              //  "statusText": "OK",
              //  "message": "Http failure during parsing for https://redacted.alma.exlibrisgroup.com/almaws/v1/conf/code-tables/PINNumberGenerationLetter?_=1723476645770",
              //  "error": {
              //    "error": {},
              //    "text": "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head><META HTTP-EQUIV=\"CONTENT-TYPE\" CONTENT=\"TEXT/HTML; CHARSET=utf-8\"/>\n<title>Error</title>\n</head>\n                                <body> <body style=\"background-color:GhostWhite;\">\n                                <center>\n                               \n                                <H1>Sorry but the page you've been looking for can't be found<br/>\n                                                <P>Please Contact your Library Support or Ex Libris HUB for additional information<br/>\n                                                The reference is the incident ID: 5437948962774151034\n                                </H1>\n                                </center>\n                                </body>\n</html>"
              //  }
              //}
              this.alert.error(`Error updating letter: ${letter.message}`);
            }
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
    let updatedLetters: Letter[] = new Array<Letter>();
    this.letters.forEach(l=> {
      if (l.isDirty()) {
        console.log(`***change detected in Letter object: ${l.description}***`)
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
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
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
    //this.letterDescriptions = new Map<string, string>();
    //this.labelLinks = new Map<string, string>();
  }

  dirtyLetters() {
    return Object.keys(this.dirtyControls).length;
  }

  // helper
  languageParameter(lang) {
    return ('?lang=' + lang);
  }

  setAllValuesChanged(newVal) {
    if (newVal == '') {
      this.resetAllValuesChanged();
    } else {
      this.letters.forEach(l=> {
        if (this.showEnabledLetters && l.addressFromEnabled ||
            this.showDisabledLetters && !l.addressFromEnabled) {
          l.addressFrom = newVal;
          this.checkDirtyLetter(l);
        }
      });
    }
  }

  clearAllValues() {
   this.letters.forEach(l=> {
     if (this.showEnabledLetters && l.addressFromEnabled ||
         this.showDisabledLetters && !l.addressFromEnabled) {
       l.addressFrom = '';
       this.checkDirtyLetter(l);
     }
   });
  }

  resetAllValuesChanged() {
    this.letters.forEach(l=> {
      l.reset();
      this.checkDirtyLetter(l);
    });
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
    this.checkDirtyLetter(letter);
  }

  checkDirtyLetter(letter: Letter) {
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
      // If we want to put disabled controls at the end, use this:
      //let  enabledValue: number = (a.addressFromEnabled ? 0 : 1) - (b.addressFromEnabled ? 0 : 1);
      //return enabledValue || a.addressFrom.localeCompare(b.addressFrom) || a.description.localeCompare(b.description);
      // If we don't care about disabled controls when sorting, use this:
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
