using { cuid } from '@sap/cds/common';

namespace config;

entity PostingBatch : cuid {
   maxFMNO_perPostingBatch: Integer;
}
