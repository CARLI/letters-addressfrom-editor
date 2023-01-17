
export class Letter {
    name: string;
    description: string;
    restObject: any;
    patronFacing: boolean;
    addressFrom: string;
    addressFromOrig: string;
    addressFromEnabled: boolean;
    addressFromEnabledOrig: boolean;

    constructor(letterRec: any) {
        this.name = letterRec.name;
        this.description = letterRec.description;
        this.patronFacing = letterRec.patron_facing;
        this.restObject = letterRec;
        this.setAddressFrom();
    };

    // A "better" dirty method:
    // I could, of course, use the builtin FormControl dirty, but
    // I like being able to detect "undo" actions (i.e., "un-dirty").
    // Also, I want a more accurate dirty method if I want to only
    // update Letters that truly need updating. This will potentially
    // save unnecessary PUTs. Is it worth it? I think so.
    isDirty() {
        if (this.addressFrom != this.addressFromOrig ||
            this.addressFromEnabled != this.addressFromEnabledOrig) {
            return true;
        }
        return false;
    }

    // if addressFrom and addressFromEnabled are set, then we are preparing to update (PUT);
    // otherwise, we are loading (GET) original values from API
    setAddressFrom(addressFrom: string = null, addressFromEnabled: boolean = null) {
        this.addressFrom = '';
        this.addressFromOrig = '';
        if (addressFrom !== null) {
            this.addressFromOrig = addressFrom;
            this.addressFrom = addressFrom;
        }
        this.addressFromEnabled = false;
        this.addressFromEnabledOrig = false;
        if (addressFromEnabled !== null) {
            this.addressFromEnabledOrig = addressFromEnabled;
            this.addressFromEnabled = addressFromEnabled;
        }
        this.restObject.row?.forEach(row => {
          if (row.code == 'addressFrom') {
            if (addressFrom !== null) {
                row.description = addressFrom;
            } else{
                this.addressFromOrig = row.description;
                this.addressFrom = row.description;
            }
            if (addressFromEnabled !== null) {
                row.enabled = addressFromEnabled;
            } else{
                this.addressFromEnabledOrig = row.enabled
                this.addressFromEnabled = row.enabled
            }
          }
        });
    }
}
