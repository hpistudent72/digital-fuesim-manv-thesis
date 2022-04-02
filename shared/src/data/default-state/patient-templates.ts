import {
    FunctionParameters,
    PatientHealthState,
    PatientTemplate,
} from '../../models';
import type { ImageProperties } from '../../models/utils';
import { healthPointsDefaults } from '../../models/utils';

const defaultImage: ImageProperties = {
    url: '/assets/patient.svg',
    height: 80,
    aspectRatio: 1,
};

const defaultHealthState = new PatientHealthState(
    new FunctionParameters(-1_000, 2_000, 1_000, 500),
    []
);

const greenPatientTemplate = new PatientTemplate(
    {
        sex: 'männlich',
        name: 'Max Mustermann',
        birthdate: '1.4.',
        biometry: '150cm, Glatze, große Brille',
        age: 18,
        address: 'Musterstr. 1, 90768 Musterstadt',
    },
    'green',
    'green',
    { [defaultHealthState.id]: defaultHealthState },
    defaultImage,
    healthPointsDefaults.greenMax
);

const yellowPatientTemplate = new PatientTemplate(
    {
        sex: 'männlich',
        name: 'Walter Falter',
        birthdate: '7.3.',
        biometry: 'blaue Augen, weiße Haare, 174cm',
        age: 73,
        address: 'Pappelstr. 69, 97537 Eschenburg',
    },
    'yellow',
    'yellow',
    { [defaultHealthState.id]: defaultHealthState },
    defaultImage,
    healthPointsDefaults.yellowMax
);

const redPatientTemplate = new PatientTemplate(
    {
        sex: 'weiblich',
        name: 'Maria Kohler',
        birthdate: '2.12.',
        biometry: 'grüne Augen, graue Haare, 167cm',
        age: 80,
        address: 'Hannibal Str. 85, 12345 Hinterstadt',
    },
    'red',
    'red',
    { [defaultHealthState.id]: defaultHealthState },
    defaultImage,
    healthPointsDefaults.redMax
);

const blackPatientTemplate = new PatientTemplate(
    {
        sex: 'männlich',
        name: 'John Doe',
        birthdate: '8.1.',
        biometry: 'kurze Haare, 186cm',
        age: 23,
        address: 'Am Musterbahnhof 5, 10010 Musterdorf',
    },
    'black',
    'black',
    { [defaultHealthState.id]: defaultHealthState },
    defaultImage,
    healthPointsDefaults.blackMax
);

export const defaultPatientTemplates: PatientTemplate[] = [
    greenPatientTemplate,
    yellowPatientTemplate,
    redPatientTemplate,
    blackPatientTemplate,
];
