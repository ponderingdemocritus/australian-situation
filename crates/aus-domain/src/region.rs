//! Region types (NSW, VIC, QLD, SA, TAS, WA, NT, ACT, AU, capital cities).

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::DomainError;

/// The category of a region.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RegionType {
    Country,
    State,
    CapitalCity,
}

/// All supported region codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, ToSchema)]
pub enum RegionCode {
    AU,
    NSW,
    VIC,
    QLD,
    SA,
    WA,
    TAS,
    NT,
    ACT,
    SYD,
    MEL,
    BNE,
    ADL,
    PER,
    HBA,
    DRW,
    CBR,
}

impl RegionCode {
    /// Returns the type of this region.
    pub fn region_type(self) -> RegionType {
        match self {
            Self::AU => RegionType::Country,
            Self::NSW
            | Self::VIC
            | Self::QLD
            | Self::SA
            | Self::WA
            | Self::TAS
            | Self::NT
            | Self::ACT => RegionType::State,
            Self::SYD
            | Self::MEL
            | Self::BNE
            | Self::ADL
            | Self::PER
            | Self::HBA
            | Self::DRW
            | Self::CBR => RegionType::CapitalCity,
        }
    }

    /// Parse a string into a `RegionCode`.
    pub fn parse(s: &str) -> Result<Self, DomainError> {
        s.parse()
            .map_err(|_| DomainError::UnsupportedRegion(s.to_string()))
    }
}

impl fmt::Display for RegionCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::AU => "AU",
            Self::NSW => "NSW",
            Self::VIC => "VIC",
            Self::QLD => "QLD",
            Self::SA => "SA",
            Self::WA => "WA",
            Self::TAS => "TAS",
            Self::NT => "NT",
            Self::ACT => "ACT",
            Self::SYD => "SYD",
            Self::MEL => "MEL",
            Self::BNE => "BNE",
            Self::ADL => "ADL",
            Self::PER => "PER",
            Self::HBA => "HBA",
            Self::DRW => "DRW",
            Self::CBR => "CBR",
        };
        f.write_str(s)
    }
}

impl FromStr for RegionCode {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "AU" => Ok(Self::AU),
            "NSW" => Ok(Self::NSW),
            "VIC" => Ok(Self::VIC),
            "QLD" => Ok(Self::QLD),
            "SA" => Ok(Self::SA),
            "WA" => Ok(Self::WA),
            "TAS" => Ok(Self::TAS),
            "NT" => Ok(Self::NT),
            "ACT" => Ok(Self::ACT),
            "SYD" => Ok(Self::SYD),
            "MEL" => Ok(Self::MEL),
            "BNE" => Ok(Self::BNE),
            "ADL" => Ok(Self::ADL),
            "PER" => Ok(Self::PER),
            "HBA" => Ok(Self::HBA),
            "DRW" => Ok(Self::DRW),
            "CBR" => Ok(Self::CBR),
            other => Err(DomainError::UnsupportedRegion(other.to_string())),
        }
    }
}

impl Serialize for RegionCode {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for RegionCode {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        s.parse().map_err(serde::de::Error::custom)
    }
}

/// Country-level region codes.
pub const COUNTRY_REGION_CODES: &[RegionCode] = &[RegionCode::AU];

/// State and territory region codes.
pub const STATE_AND_TERRITORY_REGION_CODES: &[RegionCode] = &[
    RegionCode::NSW,
    RegionCode::VIC,
    RegionCode::QLD,
    RegionCode::SA,
    RegionCode::WA,
    RegionCode::TAS,
    RegionCode::NT,
    RegionCode::ACT,
];

/// Capital city region codes.
pub const CAPITAL_CITY_REGION_CODES: &[RegionCode] = &[
    RegionCode::SYD,
    RegionCode::MEL,
    RegionCode::BNE,
    RegionCode::ADL,
    RegionCode::PER,
    RegionCode::HBA,
    RegionCode::DRW,
    RegionCode::CBR,
];

/// National + state/territory region codes.
pub const NATIONAL_AND_STATE_REGION_CODES: &[RegionCode] = &[
    RegionCode::AU,
    RegionCode::NSW,
    RegionCode::VIC,
    RegionCode::QLD,
    RegionCode::SA,
    RegionCode::WA,
    RegionCode::TAS,
    RegionCode::NT,
    RegionCode::ACT,
];

/// All core region codes (country + state + capital city).
pub const CORE_REGION_CODES: &[RegionCode] = &[
    RegionCode::AU,
    RegionCode::NSW,
    RegionCode::VIC,
    RegionCode::QLD,
    RegionCode::SA,
    RegionCode::WA,
    RegionCode::TAS,
    RegionCode::NT,
    RegionCode::ACT,
    RegionCode::SYD,
    RegionCode::MEL,
    RegionCode::BNE,
    RegionCode::ADL,
    RegionCode::PER,
    RegionCode::HBA,
    RegionCode::DRW,
    RegionCode::CBR,
];
