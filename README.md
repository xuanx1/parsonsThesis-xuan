# Trains, Lanes, and Data Grains
### Mapping Southeast Asia’s Future

A speculative exploratory urban planning engine designed for activists, policymakers, and city planners looking to shake things up. Forecasting rail connectivity development in Southeast Asia, this tool is like SimCity meets real-world infrastructure—except the stakes are higher.

By transforming biodiversity and census data into hypothetical “What-if” scenarios, it reveals indiscernible pathways through challenging terrains and natural hazards like earthquakes. Whether advocating for underserved communities or optimizing railway routes, users can explore how data-driven urban futures can reshape regional connectivity.

What if you could find the best-fit route that maximizes services to the majority of the population while avoiding seasonal hurricanes? 

**[Now, you can.](https://xuanx1.github.io/parsonsThesis-xuan/04final/)**


## Abstract
![20241012_ASP502](https://github.com/user-attachments/assets/cdaa2dc4-d57e-4b52-9a3b-9ee315577f20)
###### Source: https://www.economist.com/asia/2024/10/10/new-railways-could-transform-south-east-asia
Prior to commencing the construction of a rail network, feasibility studies are conducted. These studies include terrain analysis, identifying surrounding population clusters, and even weather conditions. A significant amount of investments, resources, and labor are dedicated to this rigorous pre-selection process. 
 
Given the geographical and socio-political challenges native to Southeast Asia—ranging from unique terrains to fragmented governance— and the political risks associated with large infrastructure projects, incorporating a data-driven calculator into the pre-selection process can increase engagement to underserved regions, maximise structure longevity and have greater consideration towards sustainable infrastructure planning, while weighing the risks specific to Southeast Asia—all of which are keys in the potential realisation of such hypothetical connectivity projects.

This project aims to develop a rail routing calculator for the general public, primarily rail enthusiasts, to route train lines and determine station placements with conditions specific to Southeast Asia. Instead of focusing solely on economically dominant areas, this "what-if" scenario helps bring attention to neglected regions by leveraging data such as ground elevation and earthquake safety distances and propose a few options of varying strengths of rail routes from Point A to Point B, which are then weighted against a final, feasibility score that is computed based on its constituent criteria. 
 
For more details, please refer to the **[Research Paper](https://docs.google.com/document/d/1o-rGQC92d79I1xqvrbZk6pjzrcNxLpUHLqgvYEci8nM/edit?usp=sharing)**

## Table of Contents
1. [Introduction](#1-introduction)
   - [1.1  Costs of Infrastructure Projects in the Southeast Asian Context](#11--costs-of-infrastructure-projects-in-the-southeast-asian-context)
   - [1.2 Project Scope](#12-project-scope)
   - [1.3 Contextualization with Existing Frameworks](#13-contextualization-with-existing-frameworks)
   - [1.4 Contextualization with Existing Methodologies](#14-contextualization-with-existing-methodologies)
 
2. [Treatment](#2-treatment)
   - [2.1 Data Types and Collection](#21-data-types-and-collection)
   - [2.2 Weighing Major Indexes](#22-weighing-major-indexes)
      - [2.2.1 Tsunami Risk Index](#221-tsunami-risk-index)
      - [2.2.2 Structure Durability Index](#222-structure-durability-index)
      - [2.2.3 Environmental Impact Index](#223-environmental-impact-index)
      - [2.2.4 Operability Index](#224-operability-index)
      - [2.2.5 Population-Economic Importance Index](#225-population-economic-importance-index)
   - [2.3 Final Feasibility Index](#23-final-feasibility-index)
   - [2.4 Visualization and Interpretation](#24-visualization-and-interpretation)
 
3. [Mockup](#3-mockup)
   
4. [Prototype](#4-prototype)
 
5. [Final Product](#5-final-product)
   - [5.1 Features](#51-features)
   - [5.2 Usage Demonstration](#52-usage-demonstration)
   - [5.3 Conclusion](#53-conclusion)
   - [5.4 Disclaimer](#54-disclaimer)
 
6. [Literature Review](#6-literature-review)
   - [6.1 Books](#61-books)  
   - [6.2 Articles](#62-articles)
   - [6.3 Indexes Development](#63-indexes-development)
   - [6.4 ASEAN Rail Infrastructure](#64-asean-rail-infrastructure)
   - [6.5 Others](#65-others)

> **📁 Project Repository**  
> Explore the [source code](https://github.com/xuanx1/parsonsThesis-xuan/blob/main/04final/js/app.js) and Xuan's [related projects](https://github.com/xuanx1?tab=repositories) on GitHub.
>
> **🎨 Design Archive**  
> View Xuan's [Online Portfolio](https://xuanx1.github.io/designArchiveWinter24/loading.html) or browse the [Physical Copy (PDF)](https://xuanx1.github.io/designArchiveWinter24/pdf/portfolio-lite.pdf), encompassing numerous interdisciplinary projects.

## 1. Introduction
#### 1.1  Costs of Infrastructure Projects in the Southeast Asian Context
Historically, Southeast Asia has struggled to develop cohesive transport networks due to natural barriers, political fragmentation, and economic disparities, which has contributed to poor urban planning and underutilized transport routes. Such pan-regional infrastructure generally requires substantial amount of funding, time and resources.

The region’s terrain, ranging from rainforests to river deltas along with its weather, characterized by monsoon seasons and high humidity—introduces new challenges to the durability and maintenance of existing infrastructure as deterioration through flooding and high humidity, has led to a necessity for frequent maintenance work and in return, their associated costs.

One of the keys to making these projects worthwhile; maximizing their utility within their limited shelf life; is to place more emphasis on the quality and inclusiveness of its planning — to get as many Southeast Asians onboard as possible.

 
#### 1.2 Project Scope
This project, inspired by the rapid urbanization and infrastructure challenges in Southeast Asia, where uneven development has led to economic disparities and access to resources, aims to develop a data visualization-based calculator that seeks to democratize civil projects in regards to public transport lines and station placements planning across Southeast Asia.

One of the key challenges amongst infrastructure projects is public perception—many believe such projects are too ambitious, complex or costly to execute. This calculator we will develop uses combinatorial optimization—called the “slime mold” as it is a natural organism known for its efficient network-building capabilities. In the name of biomimicry, this concept is applied in this context; to propose the most sensible curvature of a rail network to be constructed, demonstrating that infrastructure planning is "not as hard as we think," even in natural disasters prone environments like Southeast Asia, where factors such as tsunami can significantly impact planning doctrine.

By visualizing these factors, the tool weighs the risks and challenges specific to Southeast Asia to assist in routing train lines and determine station placements and gauges the likelihood of the realisation of such hypothetical connectivity projects.

Historically, the focus on railway expansion has always been solely on economically dominant areas. This "what-if" scenario helps bring attention to neglected regions and propose a few options of “Best Fit Curve”, each with their own varying strengths of rail routes from Point A to Point B, which are then weighted against a final, feasibility score that is computed based on its constituent criteria. By incorporating data and deriving its results, this not only allows a more inclusive infrastructure planning but also translates to the eventual ease of movement for human capital, services, and resources, facilitating economic integration in Southeast Asia.

 
 
#### 1.3 Contextualization with Existing Frameworks
 | **Framework**                                                                 | **Objectives**                                                                                                                                                                                                 | **Scope**                                                                                     | **Geographic Focus**                     | **Planning Methods**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
 |-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
 | **African Continental Free Trade Area (AfCFTA) Transport Infrastructure Development** | Promote intra-African trade by improving transport infrastructure and connectivity.                                                                                                                          | Road, rail, air, and maritime transport networks.                                             | Africa                                    | - **GIS-based spatial analysis**<br>- **Cost-benefit analysis**<br>- **Multi-criteria decision-making (MCDM)**                                                                                                                             |
 | **ASEAN Connectivity Master Plan (ACMP)**                                     | Enhance physical, institutional, and people-to-people connectivity within ASEAN Southeast Asia.                                                                                                                             | Transport, energy, ICT, and digital infrastructure.                                           | Southeast Asia (ASEAN member states)     | - **GIS for corridor mapping**<br>- **Network optimization models**<br>- **Scenario planning**                                                                                                                                                                                                 |
 | **Belt and Road Initiative (BRI)**                                            | Strengthen global trade and infrastructure networks through massive infrastructure investments.                                                                                                              | Roads, railways, ports, energy, and telecommunications.                                       | Global (primarily Asia, Europe, Africa)  | - **Combinatorial optimization**<br>- **GIS for spatial analysis**                                                                                                                                                                                                                                                         |
 | **NAFTA / USMCA Transport Corridors**                                         | Facilitate trade and transport efficiency among the U.S., Mexico, and Canada.                                                                                                                                | Road, rail, and maritime transport corridors.                                                 | North America                             | - **Traffic flow modeling**<br>- **GIS for corridor analysis**<br>- **Simulation-based optimization**                                                                                                                                                                                      |
 | **Pacific Alliance Infrastructure Integration Initiative**                    | Strengthen economic integration and infrastructure connectivity among member countries.                                                                                                                      | Transport, energy, and telecommunications.                                                   | Latin America (Chile, Colombia, Mexico, Peru) | - **GIS for spatial planning**<br>- **Economic impact analysis**<br>- **Network optimization**                                                                                                                                                                                                             |
 | **SAARC Regional Multimodal Transport Study**                                 | Develop a regional multimodal transport system to enhance connectivity and trade.                                                                                                                            | Road, rail, air, and maritime transport.                                                      | South Asia (SAARC member states)          | - **GIS for corridor identification**<br>- **Multi-modal network optimization**<br>- **Cost-effectiveness analysis**                                                                                                                                                              |
 | **Trans-European Transport Network (TEN-T)**                                 | Create a seamless and efficient transport network across the EU.                                                                                                                                             | Road, rail, air, and maritime transport, as well as logistics hubs.                           | Europe (EU member states)                 | - **Combinatorial optimization**<br>- **GIS for spatial planning**<br>- **Traffic simulation models**<br>- **Lifecycle cost analysis**                                                                                  |
 
 
#### 1.4 Contextualization with Existing Methodologies
 | Concept | Description |
 |-------------|-------------|
 | **Combinatorial Optimization** | A subset of Network Optimization Models and Urban Network Analysis (UNA) that uses mathematical approaches to find the most efficient or optimal solution from a finite set of possible options. |
 | **Geographic Information Systems (GIS)** | A tool for spatial analysis and visualization to make informed decisions about infrastructure development. |
 | **Multi-Criteria Decision-Making (MCDM)** | Maps levels of priority for projects based on multiple factors like cost, environmental impact, social benefits, and technical feasibility. |
 | **Traffic Flow Modeling and Simulation** | Used to predict and optimize traffic and logistics in transport corridors by simulating different scenarios. |
 | **Climate-Resilient Infrastructure Frameworks** | Extra considerations placed on designing and building infrastructure that can withstand the impacts of extreme weather. |
 
 
## 2. Treatment
#### 2.1 Data Types and Collection

#### Terrain Data
Ground Elevation: Digital elevation models (DEMs) and LiDAR for terrain and topography. https://opentopography.org/

Historical Earthquakes: Seismic data to spot earthquake hot zones. https://earthquake.usgs.gov/

Historical Tsunami: Records of historic tsunamis to determine safety distance away from coastlines. https://www.ngdc.noaa.gov/hazard/tsu_db.shtml

Forested Areas: Green forested cover to annotate conversation zones and mapped to evaluate environmental impact. https://globalforestwatch.org/

Coastlines: Shapefiles for coastal mapping. https://www .openstreetmap.org/

Humidity: Climate datasets for humidity levels. https://climateknowledgeportal.worldbank.org/

Biodiversity Indicators: Datasets on protected areas and species distribution. https://data.unep-wcmc.org/

#### Census Data
Population Counts: Demographic data to spot high-density areas. https://human-settlement.emergency.copernicus.eu/

Land Area: Geospatial data as a base for overlaying other data. https://www.naturalearthdata.com/

Economic Activity: Economic data to identify high-demand areas. https://data.worldbank.org/ / https://www.oecd.org/en/data.html / https://data.adb.org/

#### Miscellaneous
Existing Network: Point/Line shapefiles on roads, railways to assess connectivity and avoid redundancy and repetition of new lines on existing networks. https://data.opendatasoft.com/pages/home/
 
 
#### 2.2 Weighing Major Indexes

 #### 2.2.1 Tsunami Risk Index
 $$
 TSI = 0.4 \times (\text{Tsunami Prevalence Score}) + 0.4 \times (\text{Coastline Proximity Score}) + 0.2 \times (\text{Elevation Score})
 $$
 
 Measures the risk of tsunamis based on ground elevation, proximity to the coastline, and historical  tsunami occurrences.
| Risk Category   | Score (Min 0 - Max 1) | Interpretation |
|----------------|----------------------|----------------|
| **High Risk**  | 0.00 - 0.33          | - Frequent past tsunamis  <br> - Low elevation  <br> - Near the coast |
| **Moderate Risk** | 0.34 - 0.66       | - Occasional tsunami activity  <br> - Medium elevation |
| **Low Risk**   | 0.67 - 1.00          | - No tsunami history  <br> - High elevation  <br> - Far from coast |


 *Where:*
 
 **Tsunami Risk Index - Tsunami Prevalence Score**
 <p>
 $$\text{Tsunami Prevalence Score} = 1 - \frac{\text{Historical Tsunamis within 100 km Radius} - \text{Tsunami}_{\text{minWithinRegion}}}  {\text{Tsunami}_{\text{maxWithinRegion}} - \text{Tsunami}_{\text{minWithinRegion}}}$$
 </p>
 
 **Few Tsunami Count** – Score ~ 0.67 - 1.0
 
 **Some Tsunami Count** – Score ~ 0.34 - 0.66
 
 **Frequent Tsunamis** – Score < 0.33
 
 
 **Tsunami Risk Index - Coastline Proximity Score**
 <p>
 $$\text{Coastline Proximity Score} = \frac{\text{Distance from Coastline} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **> 10 km from Coast** – Score ~ 0.67 - 1.0

 **5 - 10 km from Coast** – Score ~ 0.34 - 0.66
 
 **0 - 5 km from Coast** – Score < 0.33
    
    
 **Tsunami Risk Index - Ground Elevation Score**
 <p>
 $$\text{Elevation Score} = \frac{\text{Elevation} - \text{Elevation}_{\text{min}}}{\text{Elevation}_{\text{max}} - \text{Elevation}_{\text{min}}}$$
 </p>
 
 **Low elevation (Below sea level or < 10 m above sea level)** – Score < 0.33
 
 **Moderate elevation (10 m – 50 m)** – Score ~ 0.34 - 0.66
 
 **High elevation (> 50 m)** – Score 0.67 - 1.0
    

    
 #### 2.2.2 Structure Durability Index
 $$
 SDI = 0.4 \times (\text{Seismic Safe Score}) + 0.25 \times (\text{Elevation Score}) + 0.2 \times (\text{Coastline Proximity Score}) + 0.15 \times (\text{Humidity})
 $$
  
Evaluates the durability of structures considering seismic activity, ground elevation, proximity to the coastline, and humidity levels.

| Durability        | Score (Min 0 - Max 1) | Interpretation |
|------------------|----------------------|----------------|
| **Poor Durability**  | 0.00 - 0.33          | - High seismic activity  <br> - Low elevation  <br> - High humidity |
| **Moderate Durability** | 0.34 - 0.66       | - Some seismic activity  <br> - Moderate elevation  <br> - Moderate humidity |
| **High Durability**   | 0.67 - 1.00          | - Low seismic activity  <br> - High elevation  <br> - Low humidity |


 *Where:*
 
 #### Structure Durability Index - Seismic Safe Score
 <p>
 $$\text{Seismic Safe Score} = \frac{\text{Distance to Fault Line} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **> 150 km Away** – Score ~ 0.67 - 1.0
 
 **50 - 150 km Away** – Score ~ 0.34 - 0.66
 
 **0 - 50 km Away** – Score < 0.33
 
 
 #### Structure Durability Index - Coastline Proximity Score
 <p>
 $$\text{Coastline Proximity Score} = \frac{\text{Distance from Coastline} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **> 10 km from Coast** – Score ~ 0.67 - 1.0

 **5 - 10 km from Coast** – Score ~ 0.34 - 0.66
 
 **0 - 5 km from Coast** – Score < 0.33
    
    
 #### Structure Durability Index - Ground Elevation Score
 <p>
 $$\text{Elevation Score} = \frac{\text{Elevation} - \text{Elevation}_{\text{min}}}{\text{Elevation}_{\text{max}} - \text{Elevation}_{\text{min}}}$$
 </p>
 
 **Low elevation (Below sea level or < 10 m above sea level)** – Score < 0.33
 
 **Moderate elevation (10 m – 50 m)** – Score ~ 0.34 - 0.66
 
 **High elevation (> 50 m)** – Score 0.67 - 1.0


  #### Structure Durability Index - Humidity Score
 <p>
 $$\text{Humidity Score} = 1 - \frac{\text{Humidity} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **High Humidity (> 80%)** – Score < 0.33
 
 **Moderate Humidity (50% - 80%)** – Score ~ 0.34 - 0.66
 
 **Low Humidity (< 50%)** – Score 0.67 - 1.0

 
 
 #### 2.2.3 Environmental Impact Index
 $$
 E2I = 0.55 \times (\text{Land Use Change}) + 0.45 \times (\text{Biodiversity Score})
 $$
  
Assesses the environmental impact based on land use changes and biodiversity loss.

| Impact Level       | Score (Min 0 - Max 1) | Interpretation |
|-------------------|----------------------|----------------|
| **High Impact**  | 0.00 - 0.33          | - Significant land conversion  <br> - High biodiversity presence |
| **Moderate Impact** | 0.34 - 0.66       | - Some land conversion  <br> - Moderate biodiversity presence |
| **Low Impact**   | 0.67 - 1.00          | - Minimal land conversion  <br> - Low biodiversity presence |


 *Where:*
 
 #### Environmental Impact Index - Land Use Change
 <p>
 $$\text{Land Use Change} = 1 - \frac{\text{X} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **Land Use Change < 10%** – Score ~ 0.67 - 1.0
 
 **Land Use Change 10 - 25%** – Score ~ 0.34 - 0.66
 
 **Land Use Change > 25%** – Score < 0.33
 
 
 #### Environmental Impact Index - Biodiversity Score
 <p>
 $$\text{Biodiversity Score} = 1 - \frac{\text{X} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **Species Density < 10%** – Score ~ 0.67 - 1.0

 **Species Density 10 - 35%** – Score ~ 0.34 - 0.66
 
 **Species Density > 30%** – Score < 0.33
    


 #### 2.2.4 Operability Index
 $$
 OPI = 0.24 \times (\text{Elevation Score}) + 0.28 \times (\text{Existing Network Score}) + 0.24 \times (\text{Urban Proximity Score}) + 0.24 \times (\text{Population Density Score})
 $$
  
Determines the operational feasibility considering ground elevation, network density, urban proximity, and population density.

| Operability Level    | Score (Min 0 - Max 1) | Interpretation |
|---------------------|----------------------|----------------|
| **Low Operability**  | 0.00 - 0.33          | - Isolated  <br> - High elevation  <br> - Low accessibility, not emergency-ready  <br> - Low population |
| **Moderate Operability** | 0.34 - 0.66       | - Moderately connected  <br> - Moderate elevation  <br> - Medium accessibility  <br> - Average population |
| **High Operability**   | 0.67 - 1.00          | - Well-connected  <br> - Low elevation  <br> - High accessibility, emergency-ready |


 *Where:*
 
 #### Operability Index - Ground Elevation Score
<p align="center">
$$
\text{Elevation Score} =
\begin{cases} 
0, & \text{if } X < 5m \text{ or } X > 60m \\
\frac{X - 5}{5}, & \text{if } 5 \leq X < 10m \\
1, & \text{if } 10 \leq X \leq 50m \\
\frac{60 - X}{10}, & \text{if } 50 < X \leq 60m \\
0, & \text{if } X > 60m
\end{cases}
$$
</p>

 **Elevation <5m or >50m** - Score 0 
 
 **Elevation between 5-10m** - Linear increase from 0 to 1
 
 **Elevation between 10-50m** - Score 1 
 
 **Elevation between 50-60m** - Linear decrease from 1 to 0; transition to undesirable
 
 **Elevation >60m** - Score 0 


  #### Operability Index - Existing Network
 <p>
 $$\text{Existing Network} = 1 - \frac{\text{Network Density} - \text{Network Density}_{\text{min}}}{\text{Network Density}_{\text{max}} - \text{Network Density}_{\text{min}}}$$
 </p>
 
 **High Accessibility (> 0.5 km/km²)** – Score < 0.33
 
 **Moderate Accessibility (0.1-0.5 km/km²)** – Score ~ 0.34 - 0.66
 
 **Low Accessibility (<0.1 km/km²)** – Score 0.67 - 1.0


   #### Operability Index - Urban Proximity Score
 <p>
 $$\text{Urban Proximity Score} = 1 - \frac{\text{X} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **Low Accessibility (> 50 km from urban center)** – Score < 0.33
 
 **Moderate Accessibility (15 km - 50 km from urban center)** – Score ~ 0.34 - 0.66
 
 **High Accessibility (< 15 km from urban center)** – Score 0.67 - 1.0


   #### Operability Index - Population Density Score
 <p>
 $$\text{Population Density Score} = 1 - \frac{\text{Density} - \text{Density}_{\text{min}}}{\text{Density}_{\text{max}} - \text{Density}_{\text{min}}}$$
 </p>
 
 **Low Demand (<500 people/km²)** – Score < 0.33
 
 **Moderate Demand (500-5,000 people/km²)** – Score ~ 0.34 - 0.66
 
 **High Demand (>5,000 people/km²)** – Score 0.67 - 1.0


 
 #### 2.2.5 Population-Economic Importance Index
 $$
 PEI = 0.35 \times (\text{Population Density Score}) + 0.4 \times (\text{GDP Per Capita Score}) + 0.25 \times (\text{Land Area Normalised})
 $$
  
Highlights the economic and population significance based on population density, land area, and GDP per capita.

| **Importance Score** (Min 0 - Max 1) | **Interpretation**                                                                 |
|--------------------------------------|-----------------------------------------------------------------------------------|
| **Low Importance** (0.00 - 0.33)     | Sparse population, High level of economic activity                                |
| **Moderate Importance** (0.34 - 0.66) | Balanced population and economic activity                                        |
| **High Importance** (0.67 - 1.0)      | High population density, Low level of economic activity                          |


 *Where:*

  #### Population-Economic Importance Index - Population Density Score
 <p>
 $$\text{Population Density Score} = 1 - \frac{\text{Density} - \text{Density}_{\text{min}}}{\text{Density}_{\text{max}} - \text{Density}_{\text{min}}}$$
 </p>
 
 **Low Economic Importance (< 500 people/km²)** – Score < 0.33
 
 **Moderate Economic Importance (500 - 5,000 people/km²)** – Score ~ 0.34 - 0.66
 
 **High Economic Importance (> 5,000 people/km²)** – Score 0.67 - 1.0


   #### Population-Economic Importance Index - Normalised Land Area
 <p>
 $$\text{Normalized Land Area} = \frac{\log(X) - \log(X_{\text{min}})}{\log(X_{\text{max}}) - \log(X_{\text{min}})}$$
 </p>

 
  #### Population-Economic Importance Index - GDP Per Capita Score
 <p>
 $$\text{GDP Per Capita Score} = \frac{\text{X} - \text{X}_{\text{min}}}{\text{X}_{\text{max}} - \text{X}_{\text{min}}}$$
 </p>
 
 **Low Economic Importance (< $5,000 USD)** – Score < 0.33
 
 **Moderate Economic Importance ($5,000 - $40,000 USD)** – Score ~ 0.34 - 0.66
 
 **High Economic Importance (> $40,000 USD)** – Score 0.67 - 1.0



#### 2.3 Final Feasibility Index
In this context, the 5 constituent indexes are combined, forming a new index which determines the score of the route from Point A to Point B. The goal is to minimise construction effort (ie. distance, terrain difficulty) while maximising regional connectivity, economic impact, and population engagement. The value here states how well the route adheres to identified constraints such as geographical hazards, population coverage, and structural resilience as the algorithm avoids areas prone to flooding or tsunamis

The Final Feasibility Index is an index that aggregates and integrates all 5 indexes into a single score:

**1. Tsunami Risk Index** (Hazard Vulnerability)

**2. Structure Durability Index** (Structural Resilience)

**3. Environmental Impact Index** (Environmental Sustainability)

**4. Operability Index** (Overall Usefulness)

**5. Population-Economic Importance Index** (Economic and Demographic Value)

The weightage assigned to each of the 5 indexes in the Final Feasibility Index is based on its significance when it comes to the feasibility of the route. 

The Tsunami Risk Index (TSI), Population-Economic Importance Index (PEI), and Structure Durability Index (SDI) are all weighted the same due to an equal emphasis on safety and prioritization serving the majority of the population, which is essential for long-term viability (Jonkman et al. 2005). 

The Operability Index (OPI) is weighted the highest as it directly affects the functionality and accessibility of the area, with access to emergency services being critical to its success as a conduit (OECD 2020). The Environmental Impact Index (E2I) is weighted the lowest as environmental sustainability is crucial but less immediately impactful in the operational aspects of such connection (World Bank 2020). 

**In the FFI, the higher the value, the more feasible the project.**

 $$
 FFI = 0.2 \times (\text{Tsunami Risk Index}) + 0.2 \times (\text{Structure Durability Index}) + 0.15 \times (\text{Environmental Impact Index}) + 0.25 \times (\text{Operability Index}) + 0.2 \times (\text{Population-Economic Importance Index})
 $$

| **Feasibility Final Score** (Min 0 - Max 1) | **Interpretation** (aka Reality Check) |
|---------------------------------------------|---------------------------------------|
| **"Why Bother?" Tier** (0.00 - 0.33) | Costs more than your annual coffee budget. Requires solving cold fusion. Permitting process involves blood sacrifices. |
| **"Maybe If We Stretch" Tier** (0.34 - 0.66) | Budget will hurt but won't kill you. Engineers will complain but do it. Only needs 3 miracle approvals. |
| **"Shut Up and Take My Money" Tier** (0.67 - 1.0) | Basically IKEA assembly instructions. Approval process involves one bored intern. ROI before lunch. |

 
#### 2.4 Visualization and Interpretation
The results are visualized using interactive network graphs, allowing users to explore the proposed network. Key features incorporated include:

-Optimal rail lines and station placements that maximize accessibility and economic impact while minimizing exposure to potential risks.

-Index value settings to amend the final result.

-Interval distances / population density threshold for station placement.

-The projected benefits of the project, one route for each strength: 
   1. Reduced travel time
   2. Improved personal safety
   3. Greater accessibility to specific regions.

-Terrain Cross Section

-Annotation on additional infrastructure required for project realisation ie. bridge, tunnel
 
 

## 3. Mockup [Preview](https://github.com/xuanx1/parsonsThesis-xuan/blob/main/02mockup/mockup.md)
![418837055-03b19321-f25a-425b-8f55-a445a6c7c242](https://github.com/user-attachments/assets/183747cf-728b-42a5-81ee-bed34741f56f)

## 4. Prototype [Preview](https://xuanx1.github.io/parsonsThesis-xuan/03prototype/)
![prototype-mockup-13](https://github.com/user-attachments/assets/b5b3e56c-8784-4349-ba3b-fd14eb8d8e16)

## 5. Final Product [Preview](https://xuanx1.github.io/parsonsThesis-xuan/04final/)
![final-cover](https://github.com/user-attachments/assets/f4fad89a-1a08-4884-9d4a-f6628cb2961d)
![final-mockup2](https://github.com/user-attachments/assets/b59795cc-c327-485a-bfa0-7c512e9a3635)
![final-mockup_feat](https://github.com/user-attachments/assets/0de78019-31ae-415f-b978-d47c64b3a059)

#### 5.1 Features
![final-mockup-05](https://github.com/user-attachments/assets/3d8d6413-a62a-48cd-9bc7-0ed7a932ed75)
![final-mockup-06](https://github.com/user-attachments/assets/c695dff4-6a15-407b-b8cd-7bcd58a78f1c)
![final-mockup-07](https://github.com/user-attachments/assets/b1a40a1a-bf58-42ef-a263-4066994a0455)
![final-mockup-08](https://github.com/user-attachments/assets/a412304b-9e69-43a7-9d79-13601bf26235)

#### 5.2 Usage Demonstration
+ 4min mp4

#### 5.3 Conclusion
The project demonstrates that combinatorial optimization can be a powerful tool in planning public transport networks in Southeast Asia, particularly in the face of the region's challenging terrain and climate. By integrating indexes and key indicators, the tool provides a data-driven approach to rail line and station placement. The proposed rail network gives space for the general public to conceptualise hypothetic connections that has yet to exist but should have existed.

#### 5.4 Disclaimer
Given the multidisciplinary nature and numerous expertise involved—engineers, urban planners, environmental scientists and policymakers, in projects of such scale, it is prudent to note that this visualization will serve as a hypothetical planning tool that democratize access to information necessary to its realisation. This would allow the public to explore different possibilities and simulate outcomes based on varying parameters (e.g. environmental factors, or population needs), while considering factors and challenges specific to Southeast Asia. 

## 6. Literature Review
#### 6.1 Books
 
Graham, Stephen. Disrupted cities: When infrastructure fails. New York, NY: Routledge, 2010. 
 
Jones, Gavin W., and Pravin Visaria. Urbanization in large developing countries: China, Indonesia, Brazil, and India. Oxford: Clarendon Press, 2023. 
 
Zembri-Mary, Geneviève. Project risks: Actions around uncertainty in urban planning and infrastructure development. London, UK, Hoboken, NJ: ISTE, Ltd. ; Wiley, 2019. 
 
Boarnet, Marlon Gary. Transportation Infrastructure: The challenges of rebuilding america. Chicago: American Planning Association, 2009. 
 
Mitra, Saptarshi, Sumana Bandyopadhyay, Stabak Roy, and Tomaz Ponce Dentinho. Railway Transportation in South Asia: Infrastructure Planning, Regional Development and economic impacts. Cham, Cham: Springer International Publishing Springer, 2021. 
 
Etingoff, Kim. Sustainable Cities Urban Planning Challenges and policy. Toronto: Apple Academic Press, 2021. 
 
 
#### 6.2 Articles
Fünfgeld, Anna. “The Dream of ASEAN Connectivity: Imagining Infrastructure in Southeast Asia.” Pacific Affairs 92, no. 2 (June 1, 2019): 287–311. https://doi.org/10.5509/2019922287. 
 
Li, Luyuan, Pieter Uyttenhove, and Veerle Van Eetvelde. “Planning Green Infrastructure to Mitigate Urban Surface Water Flooding Risk – a Methodology to Identify Priority Areas Applied in the City of Ghent.” Landscape and Urban Planning 194 (February 2020): 103703. https://doi.org/10.1016/j.landurbplan.2019.103703. 
 
Mikovits, Christian, Wolfgang Rauch, and Manfred Kleidorfer. “Importance of Scenario Analysis in Urban Development for Urban Water Infrastructure Planning and Management.” Computers, Environment and Urban Systems 68 (March 2018): 9–16. https://doi.org/10.1016/j.compenvurbsys.2017.09.006. 
 
Wang, Yafei, Zhuobiao Ni, Mengmeng Hu, Shaoqing Chen, and Beicheng Xia. “A Practical Approach of Urban Green Infrastructure Planning to Mitigate Urban Overheating: A Case Study of Guangzhou.” Journal of Cleaner Production 287 (March 2021): 124995. https://doi.org/10.1016/j.jclepro.2020.124995. 
 
“2. ASEAN Transport Policy, Infrastructure Development and Trade Facilitation.” Urbanization in Southeast Asia, December 31, 2012, 81–114. https://doi.org/10.1355/9789814380041-007. 
 
Zhang, Silin, Buhao Zhang, Yi Zhao, Shun Zhang, and Zhichao Cao. “Urban Infrastructure Construction Planning: Urban Public Transport Line Formulation.” Buildings 14, no. 7 (July 3, 2024): 2031. https://doi.org/10.3390/buildings14072031. 
 
Sturdevant, Gwynn, A. Jonathan R. Godfrey, and Andrew Gelman. “Delivering Data Differently.” arXiv.org, April 14, 2022. https://arxiv.org/abs/2204.10854. 
 
#### 6.3 Indexes Development
###### Tsunami Risk Index:
Intergovernmental Oceanographic Commission. Tsunami Risk Assessment and Mitigation for the Indian Ocean: Knowing and Managing the Risks. Paris: UNESCO, 2009.
 
Jaffe, B. E., Gelfenbaum, G., & H. M. Fritz. 2011. "The 2011 Tōhoku Tsunami Flow Depth and Inundation Mapping." Pure and Applied Geophysics 168 (5-6): 1079–93.
 
Lay, T., Kanamori, H., Ammon, C. J., & X. Chen. 2005. "The Great Sumatra-Andaman Earthquake of 26 December 2004." Science 308 (5725): 1127–1133.
 
Mori, N., Takahashi, T., & T. Yasuda. 2012. "Survey of 2011 Tōhoku Earthquake Tsunami Inundation and Run-up." Geophysical Research Letters 39 (7): L00G14.
 
Okal, E. A., & C. E. Synolakis. 2008. "Far-Field Tsunami Hazard from Mega-Thrust Earthquakes in the Indian Ocean." Geophysical Journal International 172 (3): 995–1015.
 
Satake, K., Fujii, Y., Harada, T., & Y. Namegaya. 2008. "Tsunami Source of the 2004 Sumatra-Andaman Earthquake and Its Long-Term Effects on Tectonics." Bulletin of the Seismological Society of America 98 (3): 1127–1144.
 
Berryman, K. 2006. "Review of Tsunami Hazard and Risk in New Zealand." GNS Science Report 2006/53. Wellington: GNS Science.
 
Dominey-Howes, Dale, George Papathoma, and Richard A. Cox. 2006. "Assessing the Vulnerability of Buildings to Tsunami in Coastal Thailand." Natural Hazards and Earth System Sciences 6 (5): 547–58.
 
Scheer, Stefan, Matthias Braun, and Tobias Ullmann. 2020. "Modeling Tsunami Vulnerability in Coastal Megacities: A GIS-Based Multi-Criteria Analysis." International Journal of Disaster Risk Reduction 42: 101348.
 
###### Structure Durability Index:
FEMA. Designing for Earthquakes: A Manual for Architects. Washington, DC: Federal Emergency Management Agency, 2006.
 
ASHRAE. 2022. Humidity Control Design Guide for Commercial and Institutional Buildings. Atlanta, GA: ASHRAE Press.
 
FEMA. 2021. Seismic Risk Assessment Guide for Infrastructure. Washington, D.C.: Federal Emergency Management Agency.
 
Intergovernmental Panel on Climate Change (IPCC). 2019. Special Report on the Ocean and Cryosphere in a Changing 
 
Climate. Geneva: Intergovernmental Panel on Climate Change.
 
World Bank. 2020. Urban Resilience and Infrastructure Safety in Seismic Zones. Washington, D.C.: The World Bank.
 
Camuffo, Dario. Microclimate for Cultural Heritage: Conservation, Restoration, and Maintenance of Indoor and Outdoor Monuments. 3rd ed. Amsterdam: Elsevier, 2019.
 
United States Geological Survey (USGS). Earthquake Hazards Program: Ground Motion Models and Seismic Risk Maps. Washington, D.C.: USGS, 2021.
 
Bommer, Julian J., John Douglas, and Fredrik O. Strasser. "Engineering Seismology: Ground Motion Models for Seismic Hazard Assessment." Bulletin of Earthquake Engineering 10, no. 3 (2002): 329-345.
 
###### Environmental Impact Index:
Millennium Ecosystem Assessment. Ecosystems and Human Well-being: Synthesis. Washington, DC: Island Press, 2005.
 
Giri, Chandra. Remote Sensing of Land Use and Land Cover: Principles and Applications. Boca Raton, FL: CRC Press, 2016.
 
Hansen, Matthew C., et al. "High-Resolution Global Maps of 21st-Century Forest Cover Change." Science 342, no. 6160 (2013): 850-853.
 
Intergovernmental Panel on Climate Change (IPCC). Climate Change 2021: Impacts, Adaptation, and Vulnerability. Cambridge: Cambridge University Press, 2021.
 
Butchart, Stuart H. M., et al. "Global Biodiversity: Indicators of Recent Declines." Science 328, no. 5982 (2010): 1164-1168.
 
Cardinale, Bradley J., et al. "Biodiversity Loss and Its Impact on Humanity." Nature 486, no. 7401 (2012): 59-67.
 
NASA. Earth Observation for Biodiversity and Conservation. Washington, D.C.: NASA Earth Science Division, 2021.
 
###### Operability Index:
National Research Council. Disaster Resilience: A National Imperative. Washington, DC: The National Academies Press, 2012.
 
Asian Development Bank (ADB). Infrastructure for a Seamless Asia. Tokyo: ADB Institute, 2019.
 
United Nations. Sustainable Infrastructure for Urban Development. New York: UN-Habitat, 2020.
 
Jonkman, S. N., B. Jonkman, and M. Kok. "Flood Risk Management: Principles and Implementation." Water Science & Technology 51, no. 5 (2005): 99-107.
 
Wang, Xiaojie, et al. "Urban Flood Risks and Resilience Planning: A Multi-Criteria Approach." Journal of Urban Planning and Development 147, no. 4 (2021): 04021052.
 
Eide, Arne, et al. "Emergency Response Time and Urban Accessibility: A GIS-Based Study." International Journal of Disaster Risk Science 7, no. 3 (2012): 249-261.
 
World Bank. Urbanization and Emergency Preparedness. Washington, D.C.: World Bank Group, 2019.
 
Angel, Shlomo, et al. Making Room for a Planet of Cities. Cambridge, MA: Lincoln Institute of Land Policy, 2011.
 
OECD. Regions and Cities at a Glance 2021. Paris: OECD Publishing, 2021.
 
World Health Organization. "Urban Health and Well-Being." Accessed March 18, 2025. https://www.who.int/health-topics/urban-health.
 
OECD. "Emergency Management in Urban Areas." Accessed March 18, 2025. https://www.oecd.org/gov/emergency-management/urban-areas.
 
Jonkman, S. N., et al. "Flood Risk Assessment in the Netherlands." Natural Hazards, vol. 37, no. 1, 2005, pp. 3-10.
 
OECD. Emergency Management and Urban Resilience. OECD Publishing, 2020.
 
United Nations. World Population Prospects 2020. United Nations Department of Economic and Social Affairs, 2020.
 
World Bank. Infrastructure and Operations: Addressing the Global Infrastructure Gap. World Bank, 2020.
 
###### Population-Economic Importance Index:
Angel, Shlomo, et al. Making Room for a Planet of Cities. Cambridge, MA: Lincoln Institute of Land Policy, 2011.
 
OECD. Regions and Cities at a Glance 2021. Paris: OECD Publishing, 2021.
 
United Nations. World Population Prospects 2019: Highlights. New York: United Nations, 2019.
 
Smith, Peter J., et al. "The Role of Geography in Economic Growth: Land Area and Population Density Effects." Journal of Economic Geography 18, no. 3 (2018): 499-522.
 
World Bank. Urban Development: The Role of Cities in Economic Growth. Washington, D.C.: World Bank Group, 2022.
 
OECD. Global Economic Outlook 2022: GDP Growth and Regional Trends. Paris: OECD Publishing, 2022.
 
World Bank. The Global Economy: Trends and Projections 2022. Washington, D.C.: World Bank Group, 2022.
 
#### 6.4 ASEAN Rail Infrastructure 
ASEAN Secretariat. ASEAN Rail Transport Infrastructure Master Plan. Jakarta: ASEAN Secretariat, 2020.
 
ASEAN Connectivity Coordinating Committee. Master Plan on ASEAN Connectivity 2025. Jakarta: ASEAN Secretariat, 2016.
 
Tan, Kevin S. Y. "Regional Integration through Rail: The ASEAN Rail Transport Infrastructure Master Plan." Journal of Southeast Asian Studies 52, no. 3 (2021): 456–478.
 
World Bank. Infrastructure Development in ASEAN: A Focus on Rail Transport. Washington, DC: World Bank, 2019.
 
Rahman, Arif. "ASEAN Unveils Ambitious Rail Transport Master Plan." The Straits Times, March 15, 2020.
 
Economic Research Institute for ASEAN and East Asia (ERIA). Enhancing Rail Connectivity in ASEAN: Policy Recommendations. Jakarta: ERIA, 2021.
 
Ministry of Transport, Thailand. ASEAN Rail Transport Infrastructure Development: Thailand’s Perspective. Bangkok: Ministry of Transport, 2020.
 
United Nations Economic and Social Commission for Asia and the Pacific (UNESCAP). Regional Rail Connectivity in ASEAN: Challenges and Opportunities. Bangkok: UNESCAP, 2018.
 
Nguyen, Thi Lan Hương. "The ASEAN Rail Transport Infrastructure Master Plan: Implications for Vietnam." Paper presented at the International Conference on Southeast Asian Studies, Hanoi, Vietnam, November 12–14, 2020.
 
Singh, Daljit. "ASEAN’s Infrastructure Development: The Role of Rail Transport." In ASEAN Economic Integration: Challenges and Prospects, edited by Sanchita Basu Das and Jayant Menon, 123–145. Singapore: ISEAS Publishing, 2020.
 
#### 6.5 Others
“Open Train Project.” Travegeo. Accessed March 5, 2024, https://travegeo.com/articles/open-train-project/.
 
OpenAI. ChatGPT, version GPT-4. March 18, 2025. Used for refining sentence structure and checking grammar. https://chat.openai.com.
