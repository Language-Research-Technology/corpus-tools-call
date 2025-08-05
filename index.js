import postgres from 'postgres';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { env } from 'node:process';
XLSX.set_fs(fs);

//const sql = postgres('postgres://postgres:postgres@host.docker.internal:5432/postgres');
//const sql = postgres({ host: 'host.docker.internal', database: 'postgres', port: 5432, user: 'postgres' });
const sql = env.NODE_ENV === 'production' ? postgres(env.CALL_PG_URL, { ssl: { rejectUnauthorized: false } }) : postgres(env.CALL_PG_URL);
const wb = XLSX.utils.book_new();

// Contributors
const contribMappping = {
  full_name: 'name'
};
const contributors = await sql`SELECT * FROM contributors ORDER BY id ASC;;`;
const contributorNameTypes = await sql`select distinct name_type from contributor_names;`;

const columnsContrib = contributors.columns.map(c => c.name);
const columnsContribName = contributorNameTypes.map(r => r.name_type);
const dataContrib = [[...columnsContrib, ...columnsContribName]];
// for (const nameTypes of contributorNameTypes) {
//   columnsContrib.push(nameTypes['name_type']);
// }
const contributorNames = await sql`select contributor_id, name, name_type from contributor_names;`;
const contributorNameMap = [];
for (const contrib of contributorNames) {
  //contributorNameMap[]
  if (contrib.contributor_id) { // !there are rows in the db missing the contributor_id
    let names = contributorNameMap[contrib.contributor_id] = contributorNameMap[contrib.contributor_id] || {};
    //if (names[contrib.name_type]) console.log('Duplicate name for contributor ',contrib.contributor_id);
    if (names[contrib.name_type]) {
      names[contrib.name_type].push(contrib.name);
    } else {
      names[contrib.name_type] = [contrib.name];
    }
  }
}
for (const contrib of contributors) {
  //console.log(extraNames);
  //dataContrib.push([ license.link, 'ldac:DataReuseLicense', license.name, license.license_and_permission_details]);
  const row = columnsContrib.map(c => contrib[c]);
  row.push(...columnsContribName.map(c => {
    const n = contributorNameMap[contrib.id][c];
    if (n) {
      if (n.length === 1) return n[0];
      else return `[${n.join(',')}]`;
    }
  }));
  dataContrib.push(row);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataContrib), 'Contributors');

// Licences
const dataLicenses = [
  ['@id', '@type', 'name', 'description', 'metadataIsPublic', 'allowTextIndex']
];
const licenses = await sql`select * from licences;`;
for (const license of licenses) {
  dataLicenses.push([license.link, 'ldac:DataReuseLicense', license.name, license.license_and_permission_details]);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataLicenses), 'Licenses');

async function exportObjects() {
  // RepositoryObjects
  const objects = await sql`SELECT r.*, 
  licences.link as "isRef_license", 
  activities.name as "activity", 
  publishers.name as "publisher", 
  record_formats.name as "record_format",
  types.name as "type",
  (SELECT STRING_AGG(keywords.name, ',') from item_record_keywords irk 
        INNER JOIN keywords ON irk.keyword_id = keywords.id 
        WHERE irk.item_record_id = r.id
        ) as keyword,
  (SELECT STRING_AGG(subjects.name, ',') from item_record_subjects irs 
        INNER JOIN subjects ON irs.subject_id = subjects.id 
        WHERE irs.item_record_id = r.id
        ) as subject
  from item_records r
  LEFT JOIN licences on licences.id = r.licence_id
  LEFT JOIN activities on activities.id = r.activity_id
  LEFT JOIN publishers on publishers.id = r.publisher_id
  LEFT JOIN record_formats on record_formats.id = r.record_format_id
  LEFT JOIN types on types.id = r.type_id
  ORDER BY r.id ASC;`;
  const columns = objects.columns.map(c => c.name);
  const data = [[...columns]];
  data[0][0] = '@id';

  for (const object of objects) {
    const row = columns.map(c => {
      const v = object[c];
      switch (c) {
        case 'id':
          return `#${v}`;
        case 'keyword':
        case 'subject':
          if (v) return '[' + v + ']';
        default:
          return v;
      }
    });
    //console.log(row);
    data.push(row);
  }
  //console.log(data);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Objects');
}
await exportObjects();

XLSX.writeFile(wb, 'ro-crate-metadata.xlsx');
sql.end();
